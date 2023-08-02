
out_solana-devnet=artifacts-testnet
out_mainnet=artifacts-mainnet

.PHONY: all clean build test

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
