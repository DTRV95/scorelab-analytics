import { describe, expect, it } from "vitest";
import { noteOf } from "@/lib/matchNote";

/**
 * A sugestão saía toda igual: o mesmo molde com números trocados.
 * Estes testes guardam o contrário disso — que jogos diferentes dão
 * frases diferentes, e pela razão certa.
 */

const teams = { home: "Alavés", away: "Málaga" };
const fora = (quantos: number, position?: string) =>
  Array.from({ length: quantos }, (_, i) => ({
    name: `Jogador ${i}`,
    status: "out",
    position,
  }));

describe("noteOf", () => {
  it("põe as baixas à frente de tudo, que é o que muda o jogo", () => {
    const got = noteOf({
      teams,
      goals: { home: 2.1, away: 1.4, total: 3.5 },
      absences: { Alavés: fora(4), Málaga: [] },
    });

    expect(got.text).toContain("Alavés leva 4 jogadores de fora");
    expect(got.text).toContain("não é a equipa que o modelo mediu");
    // Os golos ficam para trás: há coisa mais urgente a dizer.
    expect(got.text).not.toContain("3,5");
  });

  it("diz onde é o buraco quando as posições o dizem", () => {
    const got = noteOf({
      teams,
      absences: { Alavés: fora(4, "d"), Málaga: [] },
    });

    expect(got.text).toContain("4 deles na defesa");
  });

  it("não inventa uma linha com um desfalque espalhado", () => {
    const got = noteOf({
      teams,
      absences: {
        Alavés: [
          { name: "A", status: "out", position: "d" },
          { name: "B", status: "out", position: "m" },
          { name: "C", status: "out", position: "f" },
        ],
        Málaga: [],
      },
    });

    expect(got.text).toContain("3 jogadores de fora");
    expect(got.text).not.toContain("deles");
  });

  it("não conta como falta quem está em dúvida", () => {
    const got = noteOf({
      teams,
      goals: { home: 1.0, away: 0.9, total: 1.9 },
      absences: {
        Alavés: [
          { name: "A", status: "doubtful" },
          { name: "B", status: "doubtful" },
          { name: "C", status: "doubtful" },
        ],
        Málaga: [],
      },
    });

    expect(got.text).toContain("Jogo fechado");
  });

  it("conta os dois lados quando os dois chegam desfalcados", () => {
    const got = noteOf({
      teams: { home: "Chelsea", away: "Tottenham" },
      absences: { Chelsea: fora(8), Tottenham: fora(6) },
    });

    expect(got.text).toContain("Os dois chegam desfalcados");
    expect(got.text).toContain("8 fora no Chelsea");
  });

  it("descreve a forma do jogo quando não há desfalques", () => {
    const golos = noteOf({
      teams,
      goals: { home: 1.9, away: 1.5, total: 3.4 },
    });
    const fechado = noteOf({
      teams,
      goals: { home: 1.0, away: 0.9, total: 1.9 },
    });

    expect(golos.kind).toBe("golos");
    expect(golos.text).toContain("Esperam-se 3,40 golos");
    expect(golos.text).toContain("do Alavés");
    expect(fechado.text).toContain("Jogo fechado");
  });

  it("diz quem é favorito, ou que não há nenhum", () => {
    const comum = { teams, goals: { home: 1.4, away: 1.3, total: 2.7 } };

    expect(noteOf({ ...comum, chances: { home: 62, away: 15 } }).text).toContain(
      "Alavés é claro favorito em casa",
    );
    expect(noteOf({ ...comum, chances: { home: 15, away: 62 } }).text).toContain(
      "Málaga é favorito mesmo jogando fora",
    );
    expect(noteOf({ ...comum, chances: { home: 34, away: 33 } }).text).toContain(
      "sem favorito",
    );
  });

  it("responde à pergunta que o cartão levanta sozinho", () => {
    // O quadro lidera com um mercado e o cartão sugere outro. Sem uma
    // palavra sobre isso, quem lê fica a achar que um dos dois se
    // enganou.
    const got = noteOf({
      teams,
      goals: { home: 1.4, away: 1.3, total: 2.7 },
      chances: { home: 45, away: 25 },
      headline: "1X",
      pick: { market: "Mais de 2.5 Golos", gap: 8 },
      label: (market) => (market === "1X" ? "Casa ou Empate (1X)" : market),
    });

    expect(got.text).toContain("O quadro lidera com Casa ou Empate (1X)");
  });

  it("trata concordar com as casas como a informação que é", () => {
    const got = noteOf({
      teams,
      goals: { home: 1.4, away: 1.3, total: 2.7 },
      chances: { home: 45, away: 25 },
      headline: "Casa",
      pick: { market: "Casa", gap: 1 },
    });

    expect(got.text).toContain("da mesma maneira");
  });

  it("cala-se quando não há nada de especial para dizer", () => {
    expect(
      noteOf({
        teams,
        goals: { home: 1.4, away: 1.3, total: 2.7 },
        chances: { home: 45, away: 25 },
        headline: "Casa",
        pick: { market: "Casa", gap: 6 },
      }).text,
    ).toBe("");

    // E sem saber de nada, também.
    expect(noteOf({}).text).toBe("");
    expect(noteOf({}).kind).toBe("nada");
  });
});
