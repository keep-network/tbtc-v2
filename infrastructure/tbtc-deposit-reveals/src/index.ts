import { error, json } from "itty-router"
import router, { RouterRequest, corsify } from "#/routes"
import { Env } from "#/types"

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    return router
      .handle(request, env, context)
      .then((response) => {
        const jsonResponse = json(response)
        // Reflect the changes made by the router to the request object.
        const routerRequest = request as unknown as RouterRequest

        routerRequest.responseHeaders?.forEach(
          (headerValue: string, headerName: string) => {
            jsonResponse.headers.append(headerName, headerValue)
          },
        )

        return jsonResponse
      })
      .catch((err) => {
        console.error(err)

        return error(err)
      })
      .then(corsify)
  },
}
