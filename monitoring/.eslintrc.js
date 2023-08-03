module.exports = {
  root: true,
  extends: ["@thesis-co"],
  rules: {
    "spaced-comment": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/consistent-type-imports": "warn",
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "parent", "sibling", "index", "type"],
        "newlines-between": "always",
      },
    ],
    "import/prefer-default-export": "off",
    "class-methods-use-this": "warn",
    "@typescript-eslint/no-useless-constructor": "warn",
    "default-case": "warn",
    "max-classes-per-file": "warn",
  },
}
