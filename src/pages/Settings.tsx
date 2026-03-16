import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { User, Mail, Lock, CreditCard, Sliders, Palette } from "lucide-react";

function SettingsSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card ring-surface p-6 card-shadow">
      <div className="flex items-center gap-2 mb-5">
        <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SettingsField({ label, type = "text", defaultValue, placeholder }: { label: string; type?: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      <input type={type} defaultValue={defaultValue} placeholder={placeholder} className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
    </div>
  );
}

export default function Settings() {
  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account, preferences, and subscription.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SettingsSection title="Profile" icon={User}>
            <div className="space-y-4">
              <SettingsField label="Full Name" defaultValue="John Analyst" />
              <SettingsField label="Username" defaultValue="john_analyst" />
              <Button variant="outline" size="sm">Update Profile</Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Email" icon={Mail}>
            <div className="space-y-4">
              <SettingsField label="Email Address" type="email" defaultValue="john@example.com" />
              <Button variant="outline" size="sm">Update Email</Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Password" icon={Lock}>
            <div className="space-y-4">
              <SettingsField label="Current Password" type="password" placeholder="••••••••" />
              <SettingsField label="New Password" type="password" placeholder="••••••••" />
              <Button variant="outline" size="sm">Change Password</Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Subscription" icon={CreditCard}>
            <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/5 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Pro Plan</p>
                  <p className="text-xs text-muted-foreground">$29/month · Renews Mar 28, 2026</p>
                </div>
                <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold ring-1 ring-primary/20">Active</span>
              </div>
            </div>
            <Button variant="outline" size="sm">Manage Subscription</Button>
          </SettingsSection>

          <SettingsSection title="Defaults" icon={Sliders}>
            <div className="space-y-4">
              <SettingsField label="Default Bankroll ($)" defaultValue="5000" />
              <SettingsField label="Default Kelly Fraction" defaultValue="0.25" />
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Preferred Markets</label>
                <select className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none bg-transparent" multiple>
                  <option>Over 2.5</option>
                  <option>Under 2.5</option>
                  <option>BTTS</option>
                  <option>Over 3.5</option>
                </select>
              </div>
              <Button variant="outline" size="sm">Save Defaults</Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Appearance" icon={Palette}>
            <p className="text-sm text-muted-foreground">Dark mode is the default and recommended theme for optimal data readability.</p>
          </SettingsSection>
        </div>
      </motion.div>
    </AppLayout>
  );
}
