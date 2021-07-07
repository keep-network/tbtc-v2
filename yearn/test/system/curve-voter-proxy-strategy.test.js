const { expect } = require("chai")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

describeFn("System -- curve voter proxy strategy", () => {
  it("should be triggered", () => {
    expect(true).to.be.true
  })
})
