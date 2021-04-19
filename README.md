# keeper-db

This is a supporting repository for the [Keeper project](https://github.com/chronologic/keeper-service).

## Repository overview

This repository holds the DB schema used by Keeper, powered by https://typeorm.io/. It is meant to be used as a dependency in other repositories.

The schema should be deployed to a PostgreSQL instance.

## Tables

![DB Schema](dbSchema.png)

- `user` - users of the service
- `payment` - users' transactions that are payments for using the service
- `operator` - operator nodes' addresses; users may want to protect multiple operators and operators can be protected by many users (`many-to-many`)
- `deposit` - deposits that the service is aware of; it's a list similar to https://allthekeeps.com/deposits; `many-to-many` relation with `operator`
- `deposit_tx` - all transactions related to redeeming a deposit / minting a new one
- `user_deposit_tx_payment` - detailed records of how much each user has been charged for a given transaction during redeeming / minting; when more than one user is associated with a deposit, the transaction cost is split evenly among them

## Environment variables

This repo uses [`dotenv`](https://www.npmjs.com/package/dotenv) to load environment variables.

For development, and `.env` file should be created based on the `.env.example` template file. The `.env` file should never be commited.

In production, environment variables can be injected directly.

Below is a list of possible environment variables.

| Name           | Type     | Default | Description                                                                     |
| -------------- | -------- | ------- | ------------------------------------------------------------------------------- |
| `LOG_LEVEL`    | `string` | `info`  | Standard [`npm`](https://github.com/winstonjs/winston#logging-levels) log level |
| `DATABASE_URL` | `string` |         | PostgreSQL connection string                                                    |

## Deployment

Run `npm run db-sync` to synchronize the schema with database specified in the `DATABASE_URL` env variable. Be careful in production, as this process may be destructive!

## Creating a release

Run `npm run build-release`. This will compile the source code and switch to `release` branch. The compiled code can then be commited and tagged, e.g. `v1.0.1`. The release version may then be used as a dependency in other projects.

## Development

Set `DATABASE_URL` to point to development database instance.
Run `npm run db-sync` to synchronize the schema with the DB instance.
Run `npm run dev` to run contents of `src/dev.ts` to try out any queries etc as needed.
