import { assert } from "chai"
import { Hex } from "../src/hex"

describe("Hex", () => {
  const stringUnprefixed =
    "6e30e6da7a7881a70de2a1cf67b77f2f643e58eb0d055b0f5ef85802a9167727"
  const stringPrefixed =
    "0x6e30e6da7a7881a70de2a1cf67b77f2f643e58eb0d055b0f5ef85802a9167727"
  const stringReversed =
    "277716a90258f85e0f5b050deb583e642f7fb767cfa1e20da781787adae6306e"

  const initializers = [
    {
      name: "constructor",
      initFn: function (input: any) {
        return new Hex(input)
      },
    },
    {
      name: "static from function",
      initFn: function (input: any) {
        return Hex.from(input)
      },
    },
  ]

  initializers.forEach(({ name: initializerName, initFn }) => {
    describe(`initialized with ${initializerName}`, () => {
      const validInputTests = [
        {
          name: "unprefixed string",
          input: stringUnprefixed,
          expectedString: stringUnprefixed,
          expectedPrefixedString: stringPrefixed,
        },
        {
          name: "prefixed string",
          input: stringPrefixed,
          expectedString: stringUnprefixed,
          expectedPrefixedString: stringPrefixed,
        },
        {
          name: "prefixed uppercase string",
          input: stringPrefixed.toUpperCase(),
          expectedString: stringUnprefixed,
          expectedPrefixedString: stringPrefixed,
        },
        {
          name: "string with leading and trailing zeros",
          input: "00000a12d073c00000",
          expectedString: "00000a12d073c00000",
          expectedPrefixedString: "0x00000a12d073c00000",
        },
        {
          name: "empty string",
          input: "",
          expectedString: "",
          expectedPrefixedString: "",
        },
        {
          name: "unprefixed buffer",
          input: Buffer.from(stringUnprefixed, "hex"),
          expectedString: stringUnprefixed,
          expectedPrefixedString: stringPrefixed,
        },
        {
          name: "unprefixed uppercase buffer",
          input: Buffer.from(stringUnprefixed.toUpperCase(), "hex"),
          expectedString: stringUnprefixed,
          expectedPrefixedString: stringPrefixed,
        },
        {
          name: "empty buffer",
          input: Buffer.from("", "hex"),
          expectedString: "",
          expectedPrefixedString: "",
        },
      ]

      const invalidInputTests = [
        {
          name: "string with a character out of 0-9,a-z,A-Z",
          input: "3a9f5G",
          expectedErrorMessage: "invalid format of hex string",
        },
        {
          name: "string of odd length",
          input: "ab12345",
          expectedErrorMessage: "invalid length of hex string: 7",
        },
      ]

      validInputTests.forEach(
        ({ name, input, expectedString, expectedPrefixedString }) => {
          context(`with input as ${name}`, () => {
            const hex = initFn(input)

            describe("toString", () => {
              it("should output expected string", () => {
                const actual = hex.toString()
                assert.equal(actual, expectedString)
              })
            })

            describe("toString", () => {
              it("should output expected string", () => {
                const actual = hex.toPrefixedString()
                assert.equal(actual, expectedPrefixedString)
              })
            })
          })
        }
      )

      invalidInputTests.forEach(({ name, input, expectedErrorMessage }) => {
        context(`with input as ${name}`, () => {
          it(`should throw error with message: ${expectedErrorMessage}`, () => {
            assert.throws(
              () => {
                initFn(input)
              },
              Error,
              expectedErrorMessage
            )
          })
        })
      })

      describe("reverse", () => {
        const hex = initFn(stringPrefixed)
        const hexReversed = hex.reverse()

        it("should not modify source hex", () => {
          assert.equal(hex.toString(), stringUnprefixed)
        })

        it("should reverse target hex", () => {
          assert.equal(hexReversed.toString(), stringReversed)
        })
      })

      describe("toBuffer", () => {
        const hex = initFn(stringPrefixed)
        const expectedBuffer = Buffer.from(stringUnprefixed, "hex")

        it("should output a buffer", () => {
          assert.deepEqual(hex.toBuffer(), expectedBuffer)
        })

        it("should not modify source hex when target buffer is changed", () => {
          const buffer = hex.toBuffer()
          buffer.reverse()

          assert.equal(hex.toString(), stringUnprefixed)
        })
      })
    })
  })
})
