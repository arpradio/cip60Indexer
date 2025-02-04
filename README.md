# CIP-60 Music Token Indexer

<div align="center">
  <img width="666" alt="psyencelab" src="https://github.com/user-attachments/assets/d56aaa46-0ae2-4def-9123-e8f9a0efc5b0" />

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue.svg)](https://www.typescriptlang.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14.0-336791.svg)](https://www.postgresql.org/)
</div>

## Overview

The CIP-60 Music Token Indexer is a specialized blockchain indexing tool designed to track and catalog music-related NFTs on the Cardano blockchain that comply with the [CIP-60 NFT Metadata Standard](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0060). This tool provides real-time monitoring and indexing of music tokens, enabling efficient querying and analysis of on-chain music assets.

### Key Features

- Real-time indexing of CIP-60 (CIP-25 _only_, CIP-68 _support in the works!_) compliant music tokens
- Support for all three versions of the music metadata standard
- Automatic state management and recovery
- Live dashboard for monitoring indexing progress
- RESTful API for querying indexed assets
- PostgreSQL persistence layer

## Architecture

The indexer consists of three main components:

1. **Core Indexer**: Connects to Cardano network via Ogmios, processes blocks, and extracts music token metadata
2. **API Server**: Provides REST endpoints for querying indexed data
3. **Dashboard**: Web interface for monitoring indexing progress and system status

## Prerequisites

- [Git](https://git-scm.com/) (2.30.0 or higher)
- [Node.js](https://nodejs.org/en) (v22.10.5 or higher)
- [PostgreSQL](https://www.postgresql.org/) (14.0 or higher)
- [Ogmios](https://ogmios.dev/) (v6.0.0 or higher)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/arpradio/cip60Indexer.git
   cd cip60Indexer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   psql -U postgres -f db/init.sql
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```
   OGMIOS_URL=ws://<ogmios-host>:<port>
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=<your-password>
   DB_NAME=cip60
   ```

5. Start the indexer:
   ```bash
   npm run dev
   ```

## API Documentation

### Endpoints

#### GET /api/stats
Returns current indexing statistics and network state.

#### GET /api/assets/recent
Returns the 10 most recently indexed assets.

#### GET /api/assets?search=<searchterm>
Searches database for existing asset metadata containing matches of <searchterm>
For complete API documentation, see [API.md](docs/API.md)

## Development

### Project Structure
```
├── src/
│   ├── indexer/     # Core indexing logic
│   ├── api/         # REST API implementation
│   ├── db/          # Database schemas and migrations
│   └── dashboard/   # Web dashboard components
├── docs/            # Documentation
└── tests/           # Test suites
```

### Running Tests
```bash
npm test
```

### Building
```bash
npm run build
```

## Troubleshooting

### Common Issues

1. **Connection to Ogmios fails**
   - Verify Ogmios is running and accessible
   - Check firewall settings
   - Ensure correct WebSocket URL in .env

2. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check credentials in .env
   - Ensure database exists and schema is initialized

3. **Indexer Crashes During Sync**
   - Check available disk space
   - Verify RAM usage
   - Review logs for specific errors

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [The Psyence Lab](https://psyencelab.media/) for CIP and tooling development
- [Ogmios](https://ogmios.dev/) team for the fantastic chain sync implementation
- All contributors to this project

## Contact

- Discord: [Join our server](https://discord.gg/cBaWfKevkh)
- Twitter: [@psyencelab](https://twitter.com/psyencelab)
- Website: [psyencelab.media](https://psyencelab.media)
