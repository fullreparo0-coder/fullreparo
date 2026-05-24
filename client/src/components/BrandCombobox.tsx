import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Lista completa de marcas ──────────────────────────────────────────────────
const BRANDS: string[] = [
  // Smartphones
  "Apple",
  "Samsung",
  "Motorola",
  "Xiaomi",
  "LG",
  "Nokia",
  "Sony",
  "Huawei",
  "OnePlus",
  "OPPO",
  "Vivo",
  "Realme",
  "Asus",
  "ZTE",
  "Alcatel",
  "Positivo",
  "Multilaser",
  "TCL",
  "Google",
  "Nothing",
  "Infinix",
  "Tecno",
  "HMD",
  "Blackberry",
  "Meizu",
  // Notebooks
  "Dell",
  "HP",
  "Lenovo",
  "Acer",
  "Asus",
  "Apple",
  "Microsoft",
  "Toshiba",
  "Razer",
  "MSI",
  "Positivo",
  "Multilaser",
  "Vaio",
  "Avell",
  "Compaq",
  // Tablets
  "Apple",
  "Samsung",
  "Lenovo",
  "Huawei",
  "Amazon",
  "Microsoft",
  "Positivo",
  "Multilaser",
  // Smartwatches / Wearables
  "Apple",
  "Samsung",
  "Garmin",
  "Fitbit",
  "Xiaomi",
  "Amazfit",
  "Fossil",
  "Huawei",
  // Fones / Áudio
  "JBL",
  "Sony",
  "Bose",
  "Sennheiser",
  "Beats",
  "Apple",
  "Samsung",
  "Xiaomi",
  "Anker",
  "Edifier",
  "Philips",
  "Harman Kardon",
  // Consoles
  "Sony",
  "Microsoft",
  "Nintendo",
  "Sega",
  "Atari",
  // Câmeras
  "Canon",
  "Nikon",
  "Sony",
  "Fujifilm",
  "Panasonic",
  "Olympus",
  "Leica",
  "GoPro",
  "DJI",
  // Impressoras / Periféricos
  "HP",
  "Epson",
  "Canon",
  "Brother",
  "Lexmark",
  "Logitech",
  "Razer",
  "Corsair",
  "HyperX",
  // Outros eletrônicos
  "Intelbras",
  "D-Link",
  "TP-Link",
  "Netgear",
  "Philips",
  "LG",
  "Samsung",
  "Panasonic",
  "Brastemp",
  "Electrolux",
  "Whirlpool",
];

// Remove duplicatas e ordena alfabeticamente
const BRAND_LIST = Array.from(new Set(BRANDS)).sort((a, b) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base" })
);

// ── Props ─────────────────────────────────────────────────────────────────────
interface BrandComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Quando definido, restringe a lista às marcas permitidas (especialidades do tenant) */
  allowedBrands?: string[] | null;
}

export function BrandCombobox({
  value,
  onChange,
  placeholder = "Selecione ou digite a marca",
  className,
  disabled = false,
  allowedBrands,
}: BrandComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Lista base: restrita pelas especialidades do tenant ou todas as marcas
  const baseList = allowedBrands && allowedBrands.length > 0 ? allowedBrands : BRAND_LIST;

  // Filtra marcas pelo texto digitado
  const filtered = search.trim()
    ? baseList.filter((b) =>
        b.toLowerCase().includes(search.toLowerCase())
      )
    : baseList;

  // Abre o popover e foca no input de busca
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Seleciona uma marca da lista
  const handleSelect = (brand: string) => {
    onChange(brand);
    setOpen(false);
    setSearch("");
  };

  // Confirma digitação livre (Enter ou blur)
  const handleCustomConfirm = () => {
    if (search.trim()) {
      onChange(search.trim());
      setOpen(false);
      setSearch("");
    }
  };

  // Fecha ao pressionar Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Enter" && open && filtered.length === 0 && search.trim()) {
        handleCustomConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered.length, search]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal bg-background",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        {/* Campo de busca */}
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Buscar marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (filtered.length === 1) {
                  handleSelect(filtered[0]);
                } else if (filtered.length === 0 && search.trim()) {
                  handleCustomConfirm();
                }
              }
            }}
          />
        </div>

        {/* Lista de marcas */}
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length > 0 ? (
            filtered.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => handleSelect(brand)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  value === brand && "bg-accent/50 font-medium"
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === brand ? "opacity-100 text-primary" : "opacity-0"
                  )}
                />
                {brand}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground space-y-2">
              <p>Marca não encontrada na lista.</p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={handleCustomConfirm}
                  className="flex items-center gap-1.5 text-primary hover:underline font-medium"
                >
                  <span>Usar "{search.trim()}"</span>
                </button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
