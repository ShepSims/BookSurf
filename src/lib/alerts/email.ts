import { Resend } from "resend";
import type { AlertSender } from "@/lib/discovery/types";

function money(value: number) {
  return `$${Math.round(value)}`;
}

export class ResendAlertSender implements AlertSender {
  async sendOpportunity({ watch, opportunity, destination, reasons }: Parameters<AlertSender["sendOpportunity"]>[0]) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.BOOKSURF_FROM_EMAIL;
    if (!apiKey || !from) {
      console.info("booksurf.alert.skipped", {
        identityKey: opportunity.identityKey,
        reason: "resend_not_configured",
      });
      return { sent: false };
    }

    const resend = new Resend(apiKey);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const surf = opportunity.surfConditions;

    const result = await resend.emails.send({
      from,
      to: watch.alertEmail,
      subject: `🔥 BookSurf: ${destination.name} ${opportunity.surfScore}/100 at ${money(opportunity.totalPerPerson)}/person`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#10201d">
          <p style="letter-spacing:.14em;font-weight:700">🔥 BOOKSURF TRIGGERED</p>
          <h1 style="font-size:34px;margin-bottom:4px">${destination.name.toUpperCase()}</h1>
          <p>${opportunity.departureDate} → ${opportunity.returnDate}</p>
          <h2 style="font-size:30px">${money(opportunity.totalPerPerson)} / PERSON</h2>
          <p>${money(opportunity.totalGroupCost)} group total · ${opportunity.priceSource} pricing</p>
          <hr />
          <h3>SURF SCORE ${opportunity.surfScore} / 100</h3>
          <p><strong>Best window:</strong> ${opportunity.surfWindowStart} → ${opportunity.surfWindowEnd}</p>
          <p>${surf.waveHeightFt.toFixed(1)} ft · ${surf.swellPeriodSec.toFixed(1)} sec · ${surf.windSpeedKts.toFixed(0)} kt wind${surf.waterTemperatureF ? ` · ${surf.waterTemperatureF.toFixed(0)}°F water` : ""}</p>
          <h3>YOUR TRIP</h3>
          <p>Flight ${money(opportunity.flightPricePerPerson)}<br/>
          Stay ${money(opportunity.lodgingPerPerson)}<br/>
          Board ${money(opportunity.boardRentalPerPerson)}<br/>
          Transport ${money(opportunity.transportPerPerson)}<br/>
          Baggage ${money(opportunity.baggagePerPerson)}</p>
          <p><strong>Total ${money(opportunity.totalPerPerson)}</strong></p>
          <h3>WHY NOW</h3>
          <ul>${reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
          <p><a href="${siteUrl}/surf/opportunities">VIEW TRIP</a></p>
          <p style="font-size:12px;color:#65736f">BookSurf labels mocked and estimated prices explicitly. Confirm live availability and bookability with the linked provider.</p>
        </div>
      `,
    });
    if (result.error) throw result.error;
    return { sent: true, providerMessageId: result.data?.id };
  }
}

export class ConsoleAlertSender implements AlertSender {
  async sendOpportunity({ opportunity, destination, reasons }: Parameters<AlertSender["sendOpportunity"]>[0]) {
    console.info("booksurf.alert", {
      destination: destination.name,
      totalPerPerson: opportunity.totalPerPerson,
      surfScore: opportunity.surfScore,
      reasons,
    });
    return { sent: false };
  }
}
