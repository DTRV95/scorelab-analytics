import { useCallback, useEffect, useRef, useState } from "react";
import { useMaybeAuth } from "@/contexts/AuthContext";
import {
  fetchFavourites,
  readLocalFavourites,
  saveFavourites,
  toggled,
  writeLocalFavourites,
} from "@/lib/favourites";

/**
 * As estrelas, prontas antes de a rede responder.
 *
 * Abre com o que o telefone guardou, para a estrela já estar acesa no
 * primeiro instante, e substitui pelo que a conta diz assim que chegar.
 * Marcar é imediato: a estrela acende, a lista vai para a conta por trás, e
 * se a gravação falhar a estrela volta atrás — em vez de ficar acesa a
 * prometer uma coisa que não ficou guardada.
 */
export function useFavourites() {
  // Sem sessão — ou sem provedor à volta, como nos testes de uma
  // página isolada — os favoritos continuam a funcionar no telemóvel.
  const user = useMaybeAuth()?.user ?? null;
  const [ids, setIds] = useState<number[]>(() => readLocalFavourites());
  const [ready, setReady] = useState(false);
  // A lista mais recente, para a gravação não partir de um estado velho
  // quando se carrega em duas estrelas depressa.
  const latest = useRef(ids);
  latest.current = ids;

  useEffect(() => {
    if (!user) {
      setReady(true);
      return;
    }

    let cancelled = false;
    fetchFavourites().then((fromAccount) => {
      if (cancelled || fromAccount === null) {
        if (!cancelled) setReady(true);
        return;
      }
      setIds(fromAccount);
      writeLocalFavourites(fromAccount);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = useCallback(
    (fixtureId: number) => {
      const before = latest.current;
      const after = toggled(before, fixtureId);
      setIds(after);
      latest.current = after;
      writeLocalFavourites(after);

      if (!user) return;
      saveFavourites(user.id, after).then((saved) => {
        if (saved) return;
        // Não ficou guardado: a estrela não pode ficar acesa a dizer que sim.
        setIds(before);
        latest.current = before;
        writeLocalFavourites(before);
      });
    },
    [user],
  );

  const has = useCallback((fixtureId: number) => ids.includes(fixtureId), [ids]);

  return { ids, has, toggle, ready };
}
