import { useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, Zap } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Segmented } from "../../components/ui";
import { patchSettings, staff, useSettings } from "../../lib/store";

export function BusinessSettings() {
  const s = useSettings();
  const [pin, setPin] = useState(s.adminPin);
  const [test, setTest] = useState<"" | "sending" | "ok" | "fail">("");
  const pinProblem = !/^\d{4,8}$/.test(pin) ? "Use 4 to 8 digits." : staff.all().some((x) => x.pin === pin) ? "A staff member already uses that PIN." : null;

  const sendTest = async () => {
    setTest("sending");
    try {
      await fetch(s.leadWebhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "test", text: "Test from Axis", at: new Date().toISOString() }) });
      setTest("ok");
    } catch {
      setTest("fail");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Owner" sub="The owner signs in with the business PIN and sees everything." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" hint="Used in the greeting and on tasks"><Input value={s.ownerName} onChange={(e) => patchSettings({ ownerName: e.target.value })} /></Field>
          <Field label="Owner PIN" hint="4–8 digits">
            <Input inputMode="numeric" autoComplete="off" value={pin} className="tracking-[.3em]"
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); setPin(v); }}
              onBlur={() => !pinProblem && pin !== s.adminPin && patchSettings({ adminPin: pin })} />
            {pinProblem ? <span className="mt-1 block text-xs text-danger">{pinProblem}</span>
              : pin !== s.adminPin ? <Button size="sm" className="mt-2" onClick={() => patchSettings({ adminPin: pin })}>Save new PIN</Button>
              : <span className="mt-1 block text-xs text-fg/40">Saved. Don't share it; give staff their own PIN.</span>}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Business" />
        <Field label="Business address" hint="Shown on proposals, invoices and documents">
          <Input value={s.businessAddress} onChange={(e) => patchSettings({ businessAddress: e.target.value })} placeholder="Street, city, AZ zip" />
        </Field>
        <Field label="Theme" hint="Crew dashboard only; customer pages stay dark" className="mt-4">
          <Segmented value={s.theme} onChange={(theme) => patchSettings({ theme })}
            options={[{ value: "dark", label: <span className="flex items-center gap-1.5"><Moon size={14} /> Dark</span> }, { value: "light", label: <span className="flex items-center gap-1.5"><Sun size={14} /> Light</span> }]} />
        </Field>
        <p className="mt-4 text-sm text-fg/50">The referral credit is set in <Link to="/admin/settings/pricing" className="text-accent-fg underline-offset-2 hover:underline">Pricing</Link>.</p>
      </Card>

      <Card>
        <CardHeader title="Google review link" sub="Used in review requests when a review site in Reviews → Settings has no link." />
        <Input type="url" value={s.googleReviewUrl} onChange={(e) => patchSettings({ googleReviewUrl: e.target.value.trim() })} placeholder="https://g.page/r/…/review" aria-label="Google review link" />
        <p className="mt-2 text-xs text-fg/40">In Google Business Profile, choose “Ask for reviews” and copy the link.</p>
      </Card>

      <Card>
        <CardHeader title="Automation webhook" icon={<Zap size={16} />} sub="Every new lead and in-app notification is POSTed here as JSON." />
        <div className="flex gap-2">
          <Input type="url" value={s.leadWebhookUrl} onChange={(e) => { patchSettings({ leadWebhookUrl: e.target.value.trim() }); setTest(""); }} placeholder="https://hooks.zapier.com/…" aria-label="Webhook URL" className="min-w-0" />
          <Button variant="outline" className="!h-[50px]" disabled={!s.leadWebhookUrl || test === "sending"} onClick={sendTest}>Test</Button>
        </div>
        {test === "ok" && <p className="mt-2 text-xs text-success">Sent. Check your Zap or scenario for the test event.</p>}
        {test === "fail" && <p className="mt-2 text-xs text-danger">Couldn't reach that URL from this browser.</p>}
        <p className="mt-2 text-xs text-fg/40">Zapier: “Webhooks by Zapier → Catch Hook”. Make: “Webhooks → Custom webhook”. Then text the customer, add them to a sheet, or ping the crew.</p>
      </Card>
    </div>
  );
}
