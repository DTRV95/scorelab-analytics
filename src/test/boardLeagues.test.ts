import { describe, expect, it } from "vitest";
import {
  COVERED_LEAGUES,
  leagueCounts,
  silentLeagues,
} from "@/lib/boardLeagues";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

const game = (league: string, id: number) =>
  ({ fixture_id: id, league }) as unknown as BoardMatch;

describe("counting the board by competition", () => {
  it("names every covered competition, including the ones with nothing", () => {
    const rows = leagueCounts([game("Premier League", 1)]);

    expect(rows.map((row) => row.league).sort()).toEqual(
      [...COVERED_LEAGUES].sort(),
    );
    expect(rows.find((row) => row.league === "Eredivisie")?.count).toBe(0);
  });

  it("counts the games each competition is putting up", () => {
    const rows = leagueCounts([
      game("Eredivisie", 1),
      game("Eredivisie", 2),
      game("Serie A", 3),
    ]);

    expect(rows.find((row) => row.league === "Eredivisie")?.count).toBe(2);
    expect(rows.find((row) => row.league === "Serie A")?.count).toBe(1);
  });

  it("puts the competitions with games first", () => {
    const rows = leagueCounts([game("Eredivisie", 1), game("Serie A", 2)]);

    expect(rows.slice(0, 2).map((row) => row.league)).toEqual([
      "Eredivisie",
      "Serie A",
    ]);
    expect(rows.at(-1)?.count).toBe(0);
  });

  it("keeps counting a competition the board does not cover", () => {
    const rows = leagueCounts([game("Liga dos Campeões", 1)]);

    expect(rows.find((row) => row.league === "Liga dos Campeões")?.count).toBe(
      1,
    );
  });
});

describe("as competições que não trouxeram jogo nenhum", () => {
  it("nomeia as que ficaram caladas", () => {
    // Esta semana o Championship desapareceu três vezes, por três razões
    // diferentes, e das três o quadro ficou assim: sem a competição e sem
    // nada no ecrã a dizer que ela faltava.
    const caladas = silentLeagues([game("Premier League", 1)]);

    expect(caladas).toContain("Championship");
    expect(caladas).not.toContain("Premier League");
  });

  it("não repete as que o motor já disse que falharam", () => {
    // Essas já têm nome no ecrã, e dizê-las duas vezes com duas palavras
    // diferentes faria parecer que faltam duas coisas.
    const caladas = silentLeagues([game("Premier League", 1)], [
      "Championship",
    ]);

    expect(caladas).not.toContain("Championship");
  });

  it("fica vazio quando todas puseram alguma coisa", () => {
    const tudo = COVERED_LEAGUES.map((league, index) => game(league, index));

    expect(silentLeagues(tudo)).toEqual([]);
  });
});
