out_solana-devnet=artifacts-testnet
out_mainnet=artifacts-mainnet

.PHONY: all clean build test lint

all: test

clean:
	anchor clean
	rm -rf node_modules artifacts-mainnet artifacts-testnet

node_modules:
	npm ci

build: $(out_$(NETWORK))

$(out_$(NETWORK)):
ifdef out_$(NETWORK)
	anchor build --arch sbf -- --features "$(NETWORK)" -- --no-default-features
	mkdir -p $(out_$(NETWORK))
	cp target/deploy/*.so $(out_$(NETWORK))/
endif

test: node_modules
	anchor test --arch sbf

lint:
	cargo fmt --check
	cargo check --features "mainnet" --no-default-features
	cargo check --features "solana-devnet" --no-default-features
	cargo clippy --no-deps --all-targets -- -D warnings

init_programs:
	ts-node --files ./deploy/init.ts

transfer_authority:
	ts-node --files ./deploy/transfer_authority.ts