import {
  Router,
  IRequest,
  createCors,
  error,
  withContent,
  withCookies,
  RouterType,
  RouteHandler,
} from "itty-router"
import { Env } from "#/types"
import { getDepositsForAddress } from "./controllers/deposits"

export const { preflight, corsify } = createCors({
  origins: (_: string) => true,
  methods: ["GET", "POST", "DELETE"],
  headers: {
    "Access-Control-Allow-Credentials": true,
  },
})

const router = Router()

/**
 * Adds a property, `responseHeaders`, that can be used to modify the eventual
 * response headers without returning a response. This allows middleware to set
 * response headers.
 */
function withResponseHeaders(request: IRequest): void {
  request.responseHeaders = new Headers()
}

type TypedRoute<
  RequestType = IRequest,
  // This is a direct pull from itty router for easier typing on our end.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Args extends unknown[] = [env: Env, context: ExecutionContext],
  RT = RouterType,
> = (path: string, ...handlers: RouteHandler<RequestType, Args>[]) => RT

export type RouterRequest = IRequest & {
  cookies: Record<string, string>
  responseHeaders: Headers
  content?: Record<string, unknown>
  sessionId?: string
}
// Capture the added properties created by our middlewares.
export type MiddlewaredRouter = RouterType<TypedRoute<RouterRequest>, []>

router
  .all<IRequest, [], MiddlewaredRouter>(
    "*",
    preflight,
    withResponseHeaders,
    withCookies,
    withContent,
  )
  .get("/deposits/:address", getDepositsForAddress)
  .all("*", () => error(404, "No home route."))

export default router
