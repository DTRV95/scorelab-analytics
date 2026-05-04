import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  CreditCard,
  Sliders,
  Palette,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { resetAllScorelabData } from "@/lib/persistenceSync";
import {
  appearancePresets,
  getScoreLabAppearance,
  saveScoreLabAppearance,
  type ScoreLabAppearance,
} from "@/lib/appearanceSettings";

function SettingsSection({
  title,
  icon: Icon,
  children,
  tone = "default",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={
        tone === "danger"
          ? "scorelab-stage-3d scorelab-board-3d rounded-xl border border-red-500/20 bg-red-500/[0.04] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
          : "scorelab-stage-3d scorelab-board-3d rounded-xl bg-card ring-surface p-6 card-shadow"
      }
    >
      <div className="mb-5 flex items-center gap-2">
        <Icon
          className={tone === "danger" ? "h-4 w-4 text-red-300" : "h-4 w-4 text-muted-foreground"}
          strokeWidth={1.5}
        />
        <h2
          className={
            tone === "danger"
              ? "text-sm font-semibold uppercase tracking-wider text-red-200"
              : "text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          }
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function SettingsField({
  label,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg input-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}

export default function Settings() {
  const [isResetting, setIsResetting] = useState(false);
  const [appearance, setAppearance] = useState<ScoreLabAppearance>(() =>
    getScoreLabAppearance()
  );

  const handleStartFresh = async () => {
    setIsResetting(true);

    try {
      await resetAllScorelabData();
      toast({
        title: "ScoreLab reset",
        description: "All saved analyses, bankroll, roadmap, and multiples were cleared.",
      });

      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch {
      toast({
        title: "Reset failed",
        description: "The reset could not be completed right now.",
        variant: "destructive",
      });
      setIsResetting(false);
    }
  };

  const handleAppearanceChange = (nextAppearance: ScoreLabAppearance) => {
    setAppearance(nextAppearance);
    saveScoreLabAppearance(nextAppearance);
    toast({
      title: "Appearance updated",
      description: "Your ScoreLab visual identity has been changed.",
    });
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account, preferences, and workspace controls.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SettingsSection title="Profile" icon={User}>
            <div className="space-y-4">
              <SettingsField label="Full Name" defaultValue="John Analyst" />
              <SettingsField label="Username" defaultValue="john_analyst" />
              <Button variant="outline" size="sm">
                Update Profile
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Email" icon={Mail}>
            <div className="space-y-4">
              <SettingsField
                label="Email Address"
                type="email"
                defaultValue="john@example.com"
              />
              <Button variant="outline" size="sm">
                Update Email
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Password" icon={Lock}>
            <div className="space-y-4">
              <SettingsField
                label="Current Password"
                type="password"
                placeholder="********"
              />
              <SettingsField
                label="New Password"
                type="password"
                placeholder="********"
              />
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Subscription" icon={CreditCard}>
            <div className="scorelab-board-3d scorelab-tilt-3d mb-4 rounded-lg bg-white/[0.03] p-4 ring-1 ring-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Pro Plan</p>
                  <p className="text-xs text-muted-foreground">
                    $29/month · Renews Mar 28, 2026
                  </p>
                </div>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary ring-1 ring-primary/20">
                  Active
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Manage Subscription
            </Button>
          </SettingsSection>

          <SettingsSection title="Defaults" icon={Sliders}>
            <div className="space-y-4">
              <SettingsField label="Default Bankroll ($)" defaultValue="5000" />
              <SettingsField label="Default Kelly Fraction" defaultValue="0.25" />
              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">
                  Preferred Markets
                </label>
                <select className="h-10 w-full rounded-lg input-surface bg-transparent px-3 text-sm text-foreground focus:outline-none">
                  <option>Over 2.5</option>
                  <option>Under 2.5</option>
                  <option>BTTS</option>
                  <option>Over 3.5</option>
                </select>
              </div>
              <Button variant="outline" size="sm">
                Save Defaults
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Appearance" icon={Palette}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Visual identity
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Choose the atmosphere of the workspace, from neutral premium modes
                  to football-club-inspired color systems.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {appearancePresets.map((preset) => {
                  const isActive = appearance === preset.id;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleAppearanceChange(preset.id)}
                      className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 ${
                        isActive
                          ? "border-primary/45 bg-primary/[0.075] shadow-[0_0_30px_-18px_hsl(var(--primary))]"
                          : "border-white/8 bg-white/[0.035] hover:border-cyan-100/18 hover:bg-white/[0.055]"
                      }`}
                    >
                      <div
                        className={`relative mb-3 h-20 overflow-hidden rounded-xl ${preset.previewClassName}`}
                      >
                        <div className="absolute inset-x-4 bottom-3 h-1 rounded-full bg-white/18" />
                        <div className="absolute left-4 top-4 h-7 w-16 rounded-lg border border-white/12 bg-black/18 backdrop-blur-md" />
                        <div className="absolute right-4 top-4 h-7 w-7 rounded-full border border-white/12 bg-white/12 backdrop-blur-md" />
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_42%)] opacity-70" />
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {preset.name}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {preset.description}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                            isActive
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-white/10 bg-white/[0.04] text-white/42"
                          }`}
                        >
                          {isActive ? "Active" : preset.accent}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </SettingsSection>
        </div>

        <div className="mt-6">
          <SettingsSection title="Start Fresh" icon={RotateCcw} tone="danger">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Reset ScoreLab workspace
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This clears your bankroll, dashboard state, simple bets, multiples,
                  roadmap, and saved local backups so you can begin from zero.
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isResetting}>
                    {isResetting ? "Resetting..." : "Start From Scratch"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start fresh in ScoreLab?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the current bankroll, saved analyses,
                      multiples, roadmap history, and local backup snapshot from this
                      workspace.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleStartFresh}
                      disabled={isResetting}
                    >
                      {isResetting ? "Resetting..." : "Yes, clear everything"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </SettingsSection>
        </div>
      </motion.div>
    </AppLayout>
  );
}
