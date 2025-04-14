import { Pool, PoolClient } from 'pg';
import {Logger} from '../utils/ConsoleLogger';

export interface TokenTransfer {
  policyId: string;
  assetName: string;
  address: string;
  quantity: bigint;
  txHash: string;
  outputIndex: number;
}

export interface TransactionInput {
  txHash: string;
  outputIndex: number;
}

export class TokenHoldersTracker {
  constructor(private readonly pool: Pool) {}


  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
    
      const sql = `
        CREATE TABLE IF NOT EXISTS cip60.token_holders (
          id BIGSERIAL PRIMARY KEY,
          policy_id VARCHAR(56) NOT NULL,
          asset_name TEXT NOT NULL,
          address TEXT NOT NULL,
          quantity BIGINT NOT NULL DEFAULT 1,
          first_held_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          tx_hash VARCHAR(64) NOT NULL,
          tx_index INTEGER NOT NULL,
          is_spent BOOLEAN DEFAULT FALSE,
          CONSTRAINT unique_token_holding UNIQUE(policy_id, asset_name, address, tx_hash, tx_index)
        );
        
        CREATE INDEX IF NOT EXISTS idx_token_holders_token ON cip60.token_holders(policy_id, asset_name);
        CREATE INDEX IF NOT EXISTS idx_token_holders_address ON cip60.token_holders(address);
        CREATE INDEX IF NOT EXISTS idx_token_holders_spent ON cip60.token_holders(is_spent);
        CREATE INDEX IF NOT EXISTS idx_token_holders_tx ON cip60.token_holders(tx_hash, tx_index);
      `;
      
      await client.query(sql);
      Logger.logInfo('Token holders table initialized');
    } catch (error) {
      Logger.logError('Failed to initialize token holders table', error);
      throw error;
    } finally {
      client.release();
    }
  }


  async processTokenTransfers(
    txHash: string,
    inputs: TransactionInput[],
    outputs: TokenTransfer[]
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      

      if (inputs.length > 0) {
  
        const inputParams: any[] = [];
        const placeholders: string[] = [];
        
        inputs.forEach((input, i) => {
          inputParams.push(input.txHash, input.outputIndex);
          placeholders.push(`($${i*2+1}, $${i*2+2})`);
        });
        
        const query = `
          UPDATE cip60.token_holders 
          SET is_spent = TRUE, last_updated_at = CURRENT_TIMESTAMP 
          WHERE (tx_hash, tx_index) IN (${placeholders.join(',')})
        `;
        
        await client.query(query, inputParams);
      }

      if (outputs.length > 0) {
        const policyIds = new Set<string>();
        outputs.forEach(output => policyIds.add(output.policyId));
        
        const policyIdArr = Array.from(policyIds);
        const policiesQuery = `
          SELECT DISTINCT policy_id, asset_name 
          FROM cip60.assets 
          WHERE policy_id = ANY($1)
        `;
        
        const policiesResult = await client.query(policiesQuery, [policyIdArr]);

        const validAssets = new Set<string>();
        policiesResult.rows.forEach(row => {
          validAssets.add(`${row.policy_id}:${row.asset_name}`);
        });
        
        const validOutputs = outputs.filter(output => 
          validAssets.has(`${output.policyId}:${output.assetName}`)
        );
        
        if (validOutputs.length > 0) {
          const outputParams: any[] = [];
          const insertPlaceholders: string[] = [];
          
          validOutputs.forEach((output, i) => {
            const baseIdx = i * 6;
            outputParams.push(
              output.policyId,
              output.assetName,
              output.address,
              output.quantity.toString(),
              output.txHash,
              output.outputIndex
            );
            
            insertPlaceholders.push(
              `($${baseIdx+1}, $${baseIdx+2}, $${baseIdx+3}, $${baseIdx+4}, $${baseIdx+5}, $${baseIdx+6})`
            );
          });
          
          const insertQuery = `
            INSERT INTO cip60.token_holders
            (policy_id, asset_name, address, quantity, tx_hash, tx_index)
            VALUES ${insertPlaceholders.join(',')}
            ON CONFLICT (policy_id, asset_name, address, tx_hash, tx_index) 
            DO NOTHING
          `;
          
          await client.query(insertQuery, outputParams);
        }
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.logError('Error updating token holders', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTokenHolders(policyId: string, assetName: string): Promise<Array<{address: string; quantity: string}>> {
    try {
      const result = await this.pool.query(
        `SELECT address, SUM(quantity::bigint) as total_quantity
         FROM cip60.token_holders
         WHERE policy_id = $1 
         AND asset_name = $2
         AND is_spent = FALSE
         GROUP BY address
         ORDER BY total_quantity DESC`,
        [policyId, assetName]
      );
      
      return result.rows.map(row => ({
        address: row.address,
        quantity: row.total_quantity.toString()
      }));
    } catch (error) {
      Logger.logError('Error getting token holders', error);
      throw error;
    }
  }

  async getAddressTokens(address: string): Promise<Array<{policyId: string; assetName: string; quantity: string}>> {
    try {
      const result = await this.pool.query(
        `SELECT policy_id, asset_name, SUM(quantity::bigint) as total_quantity
         FROM cip60.token_holders
         WHERE address = $1
         AND is_spent = FALSE
         GROUP BY policy_id, asset_name
         ORDER BY policy_id, asset_name`,
        [address]
      );
      
      return result.rows.map(row => ({
        policyId: row.policy_id,
        assetName: row.asset_name,
        quantity: row.total_quantity.toString()
      }));
    } catch (error) {
      Logger.logError('Error getting address tokens', error);
      throw error;
    }
  }
}