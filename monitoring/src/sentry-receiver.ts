import { Incident, Receiver as IncidentReceiver, Severity as IncidentSeverity } from "./incident"

export class SentryReceiver implements IncidentReceiver {
  private incidentFilter = (incident: Incident) => {
    return incident.severity === IncidentSeverity.Major ||
      incident.severity === IncidentSeverity.Critical
  }

  constructor() {
    // TODO: Initialize receiver.
  }

  async receive(incidents: Incident[]): Promise<void> {
    const results = await Promise.allSettled(
      incidents.filter(this.incidentFilter).map(this.propagate)
    )

    const errors = results
      .filter(result => result.status === "rejected")
      .map(result => `${(result as PromiseRejectedResult).reason}`)

    if (errors.length !== 0) {
      throw new Error(`Sentry propagation errors: ${errors.join(",")}`)
    }
  }

  private async propagate(incident: Incident): Promise<void> {
    // TODO: Send to Sentry DSN. For now just print it.
    console.log(`incident ${incident.title} (${JSON.stringify(incident.data)}) propagated to Sentry`)
  }
}