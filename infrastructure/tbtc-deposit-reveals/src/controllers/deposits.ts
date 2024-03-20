import { IRequest, StatusError } from "itty-router"
import { Env } from "#/types"
import { DepositReceipt } from "@keep-network/tbtc-v2.ts/src/lib/contracts/bridge"

type DepositQueryResult = {
  address: string
  reveal_info: string
  metadata: string
  application: string
  inserted_at: number
}

type Deposit = {
  address: string
  revealInfo: DepositReceipt
  metadata: Object
  application: string
  insertedAt: number
}

export async function getDepositsForAddress(
  request: IRequest,
  env: Env,
): Promise<Deposit[]> {
  const {
    params: { address },
  } = request
  if (address === undefined) {
    throw new StatusError(
      500,
      "Unable to extract the address from the request.",
    )
  }
  const { results: reveals } = await env.DB.prepare(
    `
    SELECT
      address,
      reveal_info as reveal_info,
      metadata,
      application,
      CAST(strftime('%s', inserted_at) as INT) as inserted_at
    FROM reveals
    WHERE address = ?1
    `,
  )
    .bind(address)
    .all<DepositQueryResult>()

  return reveals.map((reveal) => {
    return {
      address: reveal.address,
      revealInfo: JSON.parse(reveal.reveal_info),
      metadata: JSON.parse(reveal.metadata),
      application: reveal.application,
      insertedAt: reveal.inserted_at,
    }
  })
}
