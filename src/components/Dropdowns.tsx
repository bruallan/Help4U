import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../utils";

export const ProductDropdown = ({
  availableProducts,
  selectedProducts,
  onChange,
}: {
  availableProducts: string[];
  selectedProducts: string[];
  onChange: (s: string[]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleProduct = (p: string) => {
    if (selectedProducts.includes(p))
      onChange(selectedProducts.filter((x) => x !== p));
    else onChange([...selectedProducts, p]);
  };

  const toggleAll = () => {
    if (selectedProducts.length === availableProducts.length) onChange([]);
    else onChange([...availableProducts]);
  };

  const filteredProducts = searchTerm.trim()
    ? availableProducts.filter((p) =>
        p.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : availableProducts;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
      >
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Produtos ({selectedProducts.length})
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 p-2 max-h-[400px] flex flex-col">
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm border-b border-slate-200 dark:border-slate-800 p-2 outline-none mb-2 bg-transparent text-slate-900 dark:text-slate-100"
          />
          <div
            className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer border-b border-slate-100 dark:border-slate-800 mb-1 shrink-0"
            onClick={toggleAll}
          >
            <div
              className={cn(
                "w-4 h-4 rounded flex items-center justify-center mr-3 border shrink-0",
                selectedProducts.length === availableProducts.length
                  ? "bg-orange-600 border-orange-600"
                  : "border-slate-300 dark:border-slate-700",
              )}
            >
              {selectedProducts.length === availableProducts.length && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Selecionar Todos
            </span>
          </div>

          <div className="overflow-y-auto flex-1 min-h-[50px] max-h-[250px]">
            {filteredProducts.map((prod) => {
              const isSelected = selectedProducts.includes(prod);
              return (
                <div
                  key={prod}
                  className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  onClick={() => toggleProduct(prod)}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded flex items-center justify-center mr-3 border shrink-0",
                      isSelected
                        ? "bg-orange-600 border-orange-600"
                        : "border-slate-300 dark:border-slate-700",
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span
                    className="text-sm text-slate-700 dark:text-slate-300 truncate"
                    title={prod}
                  >
                    {prod}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const UnitDropdown = ({
  availableUnits,
  selectedUnits,
  onChange,
}: {
  availableUnits: string[];
  selectedUnits: string[];
  onChange: (s: string[]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleUnit = (u: string) => {
    if (selectedUnits.includes(u))
      onChange(selectedUnits.filter((x) => x !== u));
    else onChange([...selectedUnits, u]);
  };

  const toggleAll = () => {
    if (selectedUnits.length === availableUnits.length) onChange([]);
    else onChange([...availableUnits]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
      >
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Unidades ({selectedUnits.length})
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 p-2 max-h-64 overflow-y-auto">
          <div
            className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer border-b border-slate-100 dark:border-slate-800 mb-1"
            onClick={toggleAll}
          >
            <div
              className={cn(
                "w-4 h-4 rounded flex items-center justify-center mr-3 border",
                selectedUnits.length === availableUnits.length
                  ? "bg-orange-600 border-orange-600"
                  : "border-slate-300 dark:border-slate-700",
              )}
            >
              {selectedUnits.length === availableUnits.length && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Selecionar Todas
            </span>
          </div>

          {availableUnits.map((unit) => {
            const isSelected = selectedUnits.includes(unit);
            return (
              <div
                key={unit}
                className="flex items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                onClick={() => toggleUnit(unit)}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded flex items-center justify-center mr-3 border",
                    isSelected
                      ? "bg-orange-600 border-orange-600"
                      : "border-slate-300 dark:border-slate-700",
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                  {unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
