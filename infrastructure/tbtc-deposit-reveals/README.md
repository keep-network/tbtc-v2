# Deposit Reveals API

A backend to store TBTC reveal and recovery information so that a
user does not have to.

We're using [cloudflare workers](https://workers.cloudflare.com/) with typescript,
and a D1 database for persistence.

[itty-router](https://github.com/kwhitley/itty-router) is used for routing.

## Architecture

We have a `routes.ts` file that hands off http requests to various functions within
the `controllers` folder. The controllers read from D1, giving us the
[model-view-controller pattern](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)
pattern (the view is the front end).

## Development

- local development: `yarn run dev`
- query remote D1: `yarn run query:<env> <query>`
- - example: `yarn run query:local 'select * from reveals;'`
- view pending remote migrations: `yarn run migrations:<env>:list`
- apply pending remote migrations: `yarn run migrations:<env>:apply`
- create a new migration: `yarn run migrations:create`
- reset to a bootstrapped local database: `yarn run reload_db:local`
- factory reset the local database: `yarn run reset_db:local`

## Deployment

We have two different environments: `staging` and `production`.
To deploy to an environment:

```
$ yarn run deploy --env <environment>
```

Make sure to select the "Thesis" account when prompted.
If deployment does not prompt you, log out and then back in:

```
$ npx wrangler logout
$ npx wrangler login
```
