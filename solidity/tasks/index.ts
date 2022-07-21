import fs from "fs"

// Load the `test-utils` module conditionally as it depends on the `typechain`
// directory. The `./typechain` path is used as the `tasks` module is loaded
// in the root directory context.
if (fs.existsSync("./typechain")) {
  // eslint-disable-next-line global-require
  require("./test-utils")
  // eslint-disable-next-line global-require
  require("./mint")
  // eslint-disable-next-line global-require
  require("./stake")
  // eslint-disable-next-line global-require
  require("./increase-authorization")
  // eslint-disable-next-line global-require
  require("./register-operator")
}
