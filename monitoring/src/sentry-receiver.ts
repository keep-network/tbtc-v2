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
    await Promise.allSettled(incidents.filter(this.incidentFilter).map(this.propagate))
  }

  private async propagate(incident: Incident): Promise<void> {
    // TODO: Send to Sentry DSN.
  }
}