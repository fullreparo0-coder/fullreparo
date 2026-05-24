/**
 * DeviceSpecialtiesEditor
 *
 * Editor visual de especialidades do tenant: categorias de aparelhos e marcas atendidas.
 * Suporta:
 *  - Categorias pré-definidas (DEVICE_TYPES) com toggle de ativação
 *  - Categorias personalizadas criadas pelo tenant
 *  - Marcas pré-definidas (BRAND_LIST) com busca/filtro
 *  - Marcas personalizadas (input livre) por categoria
 *  - Chips visuais de pré-visualização por categoria
 */
import { useState, useRef, useEffect } from "react";
import { DEVICE_TYPES } from "@shared/const";
import { BRAND_LIST } from "@/lib/brandModels";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Search,
  Smartphone,
  Laptop,
  Tablet,
  Watch,
  Printer,
  Gamepad2,
  Camera,
  Headphones,
  Speaker,
  Wifi,
  Tv,
  Monitor,
  Mouse,
  Plane,
  Wrench,
} from "lucide-react";

/** Ícone por tipo de aparelho */
const DEVICE_ICONS: Record<string, React.ElementType> = {
  Smartphone,
  Notebook: Laptop,
  Tablet,
  Smartwatch: Watch,
  Impressora: Printer,
  "Console / Videogame": Gamepad2,
  "Câmera / Filmadora": Camera,
  "Fone de ouvido / Headset": Headphones,
  "Caixa de som": Speaker,
  "Roteador / Modem": Wifi,
  "Smart TV": Tv,
  "Desktop / PC": Monitor,
  Monitor,
  "Teclado / Mouse": Mouse,
  Drone: Plane,
  Outro: Wrench,
};

interface DeviceSpecialtiesEditorProps {
  /** Mapa atual de especialidades: { [categoria]: [marca1, marca2, ...] } */
  value: Record<string, string[]>;
  /** Callback chamado quando o usuário altera as especialidades (não salva ainda) */
  onChange: (next: Record<string, string[]>) => void;
  /** Cor primária do tenant para os chips de pré-visualização */
  primaryColor?: string;
}

export function DeviceSpecialtiesEditor({
  value,
  onChange,
  primaryColor = "#1e3a5f",
}: DeviceSpecialtiesEditorProps) {
  // Categorias expandidas
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Busca de marcas por categoria
  const [brandSearch, setBrandSearch] = useState<Record<string, string>>({});
  // Input de marca personalizada por categoria
  const [customBrandInput, setCustomBrandInput] = useState<Record<string, string>>({});
  // Input de nova categoria personalizada
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const newCategoryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewCategory) newCategoryRef.current?.focus();
  }, [showNewCategory]);

  // Todas as categorias: pré-definidas + personalizadas (chaves do value que não estão em DEVICE_TYPES)
  const predefinedTypes = DEVICE_TYPES as readonly string[];
  const customTypes = Object.keys(value).filter((k) => !predefinedTypes.includes(k));
  const allTypes = [...predefinedTypes, ...customTypes];

  const toggleCategory = (type: string) => {
    const next = { ...value };
    if (next[type] !== undefined) {
      delete next[type];
    } else {
      next[type] = [];
    }
    onChange(next);
  };

  const toggleBrand = (type: string, brand: string) => {
    const brands = value[type] ?? [];
    const next = brands.includes(brand)
      ? brands.filter((b) => b !== brand)
      : [...brands, brand];
    onChange({ ...value, [type]: next });
  };

  const addCustomBrand = (type: string) => {
    const raw = (customBrandInput[type] ?? "").trim();
    if (!raw) return;
    const brands = value[type] ?? [];
    if (!brands.includes(raw)) {
      onChange({ ...value, [type]: [...brands, raw] });
    }
    setCustomBrandInput((prev) => ({ ...prev, [type]: "" }));
  };

  const removeCustomBrand = (type: string, brand: string) => {
    const brands = (value[type] ?? []).filter((b) => b !== brand);
    onChange({ ...value, [type]: brands });
  };

  const addCustomCategory = () => {
    const raw = newCategoryInput.trim();
    if (!raw || value[raw] !== undefined) return;
    onChange({ ...value, [raw]: [] });
    setNewCategoryInput("");
    setShowNewCategory(false);
    // Expande automaticamente a nova categoria
    setExpanded((prev) => ({ ...prev, [raw]: true }));
  };

  const removeCustomCategory = (type: string) => {
    const next = { ...value };
    delete next[type];
    onChange(next);
  };

  const toggleExpand = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="space-y-2">
      {allTypes.map((type) => {
        const isCustomType = !predefinedTypes.includes(type);
        const isActive = value[type] !== undefined;
        const selectedBrands = value[type] ?? [];
        const isExpanded = !!expanded[type];
        const search = brandSearch[type] ?? "";
        const Icon = DEVICE_ICONS[type] ?? Wrench;

        // Marcas pré-definidas filtradas pela busca
        const filteredPreset = BRAND_LIST.filter(
          (b) =>
            b.toLowerCase().includes(search.toLowerCase()) &&
            !selectedBrands.includes(b)
        );
        // Marcas personalizadas (não estão no BRAND_LIST)
        const customBrands = selectedBrands.filter((b) => !BRAND_LIST.includes(b));

        return (
          <div
            key={type}
            className={`rounded-xl border transition-all duration-150 overflow-hidden ${
              isActive
                ? "border-primary/30 bg-primary/[0.03] shadow-sm"
                : "border-border bg-muted/20"
            }`}
          >
            {/* ── Cabeçalho da categoria ── */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Checkbox
                id={`cat-${type}`}
                checked={isActive}
                onCheckedChange={() => toggleCategory(type)}
              />
              <label
                htmlFor={`cat-${type}`}
                className="flex items-center gap-2 flex-1 cursor-pointer select-none min-w-0"
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-sm font-medium truncate ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {type}
                  {isCustomType && (
                    <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 align-middle">
                      personalizada
                    </Badge>
                  )}
                </span>
              </label>

              {/* Chips de marcas selecionadas (preview rápido) */}
              {isActive && selectedBrands.length > 0 && !isExpanded && (
                <div className="hidden sm:flex items-center gap-1 flex-wrap max-w-[200px] overflow-hidden">
                  {selectedBrands.slice(0, 3).map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
                      style={{
                        backgroundColor: `${primaryColor}18`,
                        color: primaryColor,
                        border: `1px solid ${primaryColor}30`,
                      }}
                    >
                      {b}
                    </span>
                  ))}
                  {selectedBrands.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{selectedBrands.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Contador de marcas */}
              {isActive && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {selectedBrands.length === 0
                    ? "Todas"
                    : `${selectedBrands.length} marca${selectedBrands.length !== 1 ? "s" : ""}`}
                </span>
              )}

              {/* Botão expandir/recolher */}
              {isActive && (
                <button
                  type="button"
                  onClick={() => toggleExpand(type)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5 rounded"
                  aria-label={isExpanded ? "Recolher" : "Expandir marcas"}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}

              {/* Botão remover categoria personalizada */}
              {isCustomType && (
                <button
                  type="button"
                  onClick={() => removeCustomCategory(type)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5 rounded"
                  aria-label={`Remover categoria ${type}`}
                  title="Remover categoria personalizada"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ── Painel de marcas (expandido) ── */}
            {isActive && isExpanded && (
              <div className="border-t border-border bg-background px-4 py-4 space-y-4">
                {/* Chips de marcas selecionadas */}
                {selectedBrands.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Marcas selecionadas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBrands.map((brand) => (
                        <span
                          key={brand}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: `${primaryColor}18`,
                            color: primaryColor,
                            border: `1px solid ${primaryColor}35`,
                          }}
                        >
                          {brand}
                          <button
                            type="button"
                            onClick={() =>
                              BRAND_LIST.includes(brand)
                                ? toggleBrand(type, brand)
                                : removeCustomBrand(type, brand)
                            }
                            className="ml-0.5 hover:opacity-60 transition-opacity"
                            aria-label={`Remover ${brand}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nota sobre "todas as marcas" */}
                {selectedBrands.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma marca selecionada — aparece como "todas as marcas" no portal público.
                    Selecione abaixo para filtrar.
                  </p>
                )}

                {/* Busca de marcas pré-definidas */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Adicionar marca
                  </p>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) =>
                        setBrandSearch((prev) => ({ ...prev, [type]: e.target.value }))
                      }
                      placeholder="Buscar marca..."
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  {/* Grid de marcas filtradas */}
                  {filteredPreset.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                      {filteredPreset.slice(0, 60).map((brand) => (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => toggleBrand(type, brand)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                        >
                          <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{brand}</span>
                        </button>
                      ))}
                      {filteredPreset.length > 60 && (
                        <p className="col-span-full text-xs text-muted-foreground px-2 py-1">
                          Refine a busca para ver mais marcas.
                        </p>
                      )}
                    </div>
                  ) : search ? (
                    <p className="text-xs text-muted-foreground py-2 px-1">
                      Nenhuma marca encontrada para "{search}".
                    </p>
                  ) : null}
                </div>

                {/* Adicionar marca personalizada */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Marca não listada?
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={customBrandInput[type] ?? ""}
                      onChange={(e) =>
                        setCustomBrandInput((prev) => ({ ...prev, [type]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomBrand(type);
                        }
                      }}
                      placeholder="Digite o nome da marca..."
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs shrink-0"
                      onClick={() => addCustomBrand(type)}
                      disabled={!(customBrandInput[type] ?? "").trim()}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Adicionar categoria personalizada ── */}
      {showNewCategory ? (
        <div className="flex gap-2 items-center rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] px-4 py-3">
          <Input
            ref={newCategoryRef}
            value={newCategoryInput}
            onChange={(e) => setNewCategoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomCategory();
              }
              if (e.key === "Escape") {
                setShowNewCategory(false);
                setNewCategoryInput("");
              }
            }}
            placeholder="Nome da categoria (ex: Drone, Projetor...)"
            className="h-8 text-sm flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={addCustomCategory}
            disabled={!newCategoryInput.trim()}
            className="h-8 px-3 text-xs shrink-0"
          >
            Adicionar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs shrink-0"
            onClick={() => {
              setShowNewCategory(false);
              setNewCategoryInput("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewCategory(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/[0.03] transition-all duration-150"
        >
          <Plus className="h-4 w-4" />
          Adicionar categoria personalizada
        </button>
      )}
    </div>
  );
}
