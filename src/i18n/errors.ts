import type messages from "../../messages/fr.json";

/** A key under `errors` in the message catalogs. */
export type ErrorCode = keyof (typeof messages)["errors"];
