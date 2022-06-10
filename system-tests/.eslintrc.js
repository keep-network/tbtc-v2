module.exports = {
  extends: ["@thesis-co"],
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "valid-jsdoc": [
      "error",
      {
        prefer: { return: "returns" },
        requireParamType: false,
        requireReturnType: false,
      },
    ],
  },
}
