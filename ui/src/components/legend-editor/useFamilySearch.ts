import { useEffect, useState } from "react";
import { api, type FamilyItem } from "../../api";

/** Library search of the editor: at least two characters, debounced, ten hits. */
export function useFamilySearch() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FamilyItem[]>([]);
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = window.setTimeout(() => {
      api
        .families({ q: search, category: "", dataset: "", mounting: "", all_variants: false })
        .then((r) => setResults(r.items.slice(0, 10)))
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(h);
  }, [search]);
  return { search, setSearch, results };
}
