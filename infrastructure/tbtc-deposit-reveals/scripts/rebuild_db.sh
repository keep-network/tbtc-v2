#!/bin/sh

yarn run query:local --file ./scripts/reset_db.sql
yes | yarn run migrations:local:apply
yarn run query:local --file ./scripts/local_data.sql
