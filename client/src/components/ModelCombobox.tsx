import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getModelsForBrand } from "@/lib/brandModels";

interface ModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  brand: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ModelCombobox({
  value,
  onChange,
  brand,
  placeholder = "Selecione ou digite o modelo",
  disabled = false,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const prevBrand = useRef(brand);

  // Quando a marca muda, limpa o modelo selecionado
  useEffect(() => {
    if (prevBrand.current !== brand) {
      prevBrand.current = brand;
      onChange("");
      setInputValue("");
    }
  }, [brand, onChange]);

  // Sincroniza inputValue com value externo
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const models = getModelsForBrand(brand);

  const filtered = inputValue
    ? models.filter((m) =>
        m.toLowerCase().includes(inputValue.toLowerCase())
      )
    : models;

  const handleSelect = (model: string) => {
    onChange(model);
    setInputValue(model);
    setOpen(false);
  };

  const handleInputChange = (search: string) => {
    setInputValue(search);
    // Permite digitar modelo personalizado
    onChange(search);
  };

  const noModels = models.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={
              noModels
                ? "Digite o modelo do aparelho..."
                : "Buscar modelo..."
            }
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            {noModels ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Smartphone className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {brand
                  ? `Nenhum modelo cadastrado para ${brand}.`
                  : "Selecione uma marca primeiro."}
                <p className="mt-1 text-xs">
                  Digite o modelo manualmente acima.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <CommandEmpty>
                <div className="py-2 text-center text-sm text-muted-foreground">
                  <p>Modelo não encontrado na lista.</p>
                  {inputValue && (
                    <button
                      className="mt-1 text-xs text-primary underline underline-offset-2"
                      onClick={() => handleSelect(inputValue)}
                    >
                      Usar "{inputValue}" como modelo personalizado
                    </button>
                  )}
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup
                heading={
                  brand
                    ? `Modelos ${brand} (${filtered.length})`
                    : `Modelos (${filtered.length})`
                }
              >
                {filtered.slice(0, 80).map((model) => (
                  <CommandItem
                    key={model}
                    value={model}
                    onSelect={() => handleSelect(model)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === model ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {model}
                  </CommandItem>
                ))}
                {filtered.length > 80 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    +{filtered.length - 80} modelos — refine a busca para ver
                    mais.
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
