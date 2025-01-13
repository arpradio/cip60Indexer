<img width="666" alt="psyencelab" src="https://github.com/user-attachments/assets/e1d10ccd-a411-4d85-9fb0-549f6ca36bcd" />

# cip60Indexer
Music Token (CIP-60 compliant) indexing tool for the Cardano blockchain using Ogmios and Postgres

**Requirements**
    1. A Postgres database (create scripts for the needed tables are provided)
    2. Ogmios - either as standalone (for remote node connection) or cardano-node-ogmios build.
    3. NodeJS/Typescript

The process is requires two database tables: one to store token information, and another to store sync states.  The process can be interrupted and resumed.


