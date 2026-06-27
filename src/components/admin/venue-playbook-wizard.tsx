"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  applyGeneratedVenuePlaybook,
  applyGeneratedVenuePlaybookForLocation,
  loadPlaybookWizardDefaults,
  previewVenuePlaybook,
  type PlaybookWizardInput,
} from "@/lib/admin/generate-venue-playbook-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const VENUE_TYPES: { value: PlaybookWizardInput["venueType"]; label: string }[] =
  [
    { value: "restaurant", label: "Restoran" },
    { value: "bar", label: "Bar" },
    { value: "cafe", label: "Kafić" },
    { value: "fast_food", label: "Fast food" },
    { value: "hotel", label: "Hotel" },
    { value: "lounge", label: "Lounge" },
  ];

const TONE_OPTIONS: {
  value: PlaybookWizardInput["tonePreference"];
  label: string;
}[] = [
  { value: "relaxed", label: "Opušteno" },
  { value: "formal", label: "Formalno" },
  { value: "luxury", label: "Luksuzno" },
];

const PRICE_OPTIONS: {
  value: PlaybookWizardInput["priceRange"];
  label: string;
}[] = [
  { value: "budget", label: "Budget" },
  { value: "mid", label: "Mid" },
  { value: "premium", label: "Premium" },
];

const LANGUAGE_OPTIONS = [
  { value: "sr", label: "Srpski" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
];

type Props = {
  canEdit: boolean;
  /** When set, apply playbook to this location (post-create onboarding). */
  locationId?: string;
  onApplied?: (playbook: string) => void;
  compact?: boolean;
};

export function VenuePlaybookWizard({
  canEdit,
  locationId,
  onApplied,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(!compact);
  const [venueType, setVenueType] =
    useState<PlaybookWizardInput["venueType"]>("restaurant");
  const [tonePreference, setTonePreference] =
    useState<PlaybookWizardInput["tonePreference"]>("relaxed");
  const [priceRange, setPriceRange] =
    useState<PlaybookWizardInput["priceRange"]>("mid");
  const [language, setLanguage] = useState("sr");
  const [specialtyText, setSpecialtyText] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewTone, setPreviewTone] = useState<string | null>(null);
  const [menuHint, setMenuHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!canEdit) return;
    void loadPlaybookWizardDefaults(locationId).then((result) => {
      if ("error" in result) return;
      if (!("defaults" in result) || !result.defaults) return;
      setLanguage(result.defaults.language || "sr");
      const sections = result.defaults.menuSections.slice(0, 4).join(", ");
      const products = result.defaults.topProducts
        .slice(0, 3)
        .map((p: { name: string }) => p.name)
        .join(", ");
      const hints = [sections && `Sekcije: ${sections}`, products && `Top: ${products}`]
        .filter(Boolean)
        .join(" · ");
      if (hints) setMenuHint(hints);
    });
  }, [canEdit, locationId]);

  function wizardInput(): PlaybookWizardInput {
    const specialties = specialtyText
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    return {
      venueType,
      tonePreference,
      priceRange,
      language,
      specialties,
    };
  }

  function handlePreview() {
    startTransition(async () => {
      const result = await previewVenuePlaybook(wizardInput(), locationId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (!("playbook" in result)) return;
      setPreviewText(result.playbook ?? "");
      setPreviewTone("tone" in result ? (result.tone ?? null) : null);
    });
  }

  function handleApply() {
    startTransition(async () => {
      const input = wizardInput();
      const result = locationId
        ? await applyGeneratedVenuePlaybookForLocation(locationId, input)
        : await applyGeneratedVenuePlaybook(input);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Playbook generisan i sačuvan.");
      if ("playbook" in result && typeof result.playbook === "string") {
        onApplied?.(result.playbook);
      } else if (previewText) {
        onApplied?.(previewText);
      }
      if (!compact) setOpen(false);
    });
  }

  if (!canEdit) return null;

  if (compact && !open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="mr-2 size-4" />
        Generiši playbook (5 pitanja)
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Smart playbook — onboarding
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Denis generiše predlog pravila iz profila lokala i menija. Uvek možeš
            da edituješ posle.
          </p>
        </div>
        {compact && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Zatvori
          </Button>
        )}
      </div>

      {menuHint ? (
        <p className="mt-2 text-xs text-muted-foreground">VKG meni: {menuHint}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>1. Tip lokala</Label>
          <Select
            value={venueType}
            onValueChange={(v) =>
              setVenueType(v as PlaybookWizardInput["venueType"])
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VENUE_TYPES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>2. Ton</Label>
          <Select
            value={tonePreference}
            onValueChange={(v) =>
              setTonePreference(v as PlaybookWizardInput["tonePreference"])
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="playbook-specialty">3. Specialty kuće</Label>
          <Input
            id="playbook-specialty"
            className="mt-1"
            placeholder="npr. ćevapi, mešano meso, signature Negroni"
            value={specialtyText}
            onChange={(e) => setSpecialtyText(e.target.value)}
          />
        </div>

        <div>
          <Label>4. Cenovni rang</Label>
          <Select
            value={priceRange}
            onValueChange={(v) =>
              setPriceRange(v as PlaybookWizardInput["priceRange"])
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>5. Primarni jezik</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => void handlePreview()}
        >
          {pending ? "Generišem…" : "Pregled predloga"}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => void handleApply()}
        >
          {pending ? "Čuvam…" : "Primeni playbook"}
        </Button>
      </div>

      {previewText ? (
        <div className="mt-4 space-y-2">
          {previewTone ? (
            <p className="text-xs text-muted-foreground">
              Denis ton: <span className="font-medium text-foreground">{previewTone}</span>
            </p>
          ) : null}
          <Textarea
            readOnly
            rows={6}
            value={previewText}
            className="text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}
