import { describe, expect, it } from "vitest";
import { describeHealth, type LeagueHealth } from "@/lib/leagueHealth";

const linha = (parte: Partial<LeagueHealth>): LeagueHealth => ({
  league: "Liga dos Campeões",
  code: "CL",
  ok: true,
  error: null,
  matches: 144,
  finished: 36,
  upcoming: 90,
  within_days: 0,
  window_statuses: {},
  next_kickoff: null,
  season: "2026",
  ...parte,
});

describe("a linha de uma competição que não aparece no quadro", () => {
  it("diz em que estado a fonte tem os jogos desta janela", () => {
    // "Sem jogos nesta janela" não chega a quem está a ver dezoito jogos
    // marcados no calendário. A diferença entre o que a pessoa vê e o que o
    // quadro leva tem um nome, e é o estado.
    const texto = describeHealth(linha({ window_statuses: { POSTPONED: 18 } }));

    expect(texto).toContain("18 adiado");
  });

  it("junta os estados que querem dizer o mesmo", () => {
    const texto = describeHealth(
      linha({ window_statuses: { SCHEDULED: 2, TIMED: 1, CANCELLED: 3 } }),
    );

    // Marcado é marcado, e esses o quadro leva — não se explicam. Os três
    // cancelados é que são a resposta.
    expect(texto).toContain("3 cancelado");
    expect(texto).not.toContain("por disputar nesta janela");
  });

  it("não inventa uma explicação quando não há nenhuma", () => {
    const texto = describeHealth(linha({ window_statuses: {} }));

    expect(texto).not.toContain("A fonte marca");
  });

  it("deixa em paz a competição que está a pôr jogos no quadro", () => {
    const texto = describeHealth(
      linha({ within_days: 14, window_statuses: { TIMED: 14 } }),
    );

    expect(texto).toContain("14 jogos nesta janela");
  });
});
