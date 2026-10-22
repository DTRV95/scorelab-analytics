import { describe, expect, it } from "vitest";
import {
  buildDossier,
  enumerate,
  objections,
  type DossierInput,
} from "@/lib/matchDossier";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

const form = {
  jogos_casa: 9,
  jogos_fora: 8,
  jogos_casa_rec: 5,
  jogos_fora_rec: 5,
  league_averages: { sample_matches: 180 },
};

function input(over: Partial<DossierInput> = {}): DossierInput {
  return {
    amostraLabel: "Alta",
    amostraPct: 92,
    form,
    headline: { market: "1X", pct: 74 },
    record: null,
    oddsTyped: 0,
    ...over,
  };
}

function mercado(
  odds: Record<string, number> = { "1X": 1.45, Casa: 1.90, Empate: 3.60 },
  implied: Record<string, number> = { "1X": 70, Casa: 50, Empate: 20 },
) {
  return { odds, implied };
}

function record(over: Partial<AccuracyMarket> = {}): AccuracyMarket {
  return {
    market: "1X",
    grupo: "Resultado",
    samples: 120,
    predicted_pct: 74,
    actual_pct: 62,
    gap_pp: -12,
    brier: 0.2,
    ...over,
  };
}

describe("buildDossier", () => {
  it("conta o que sabemos e o que falta", () => {
    const dossier = buildDossier(input());

    expect(dossier.total).toBe(7);
    // Histórico, forma, casa/fora e média da liga. Registo, preço do
    // mercado e a odd escrita ficam por preencher.
    expect(dossier.known).toBe(4);
  });

  it("trata o preço do mercado como o buraco que pesa", () => {
    const dossier = buildDossier(input());

    expect(dossier.heavyMissing).toEqual(["o que as casas estão a pagar"]);
  });

  it("acende o mercado quando as casas abriram o jogo", () => {
    const dossier = buildDossier(input({ market: mercado() }));
    const linha = dossier.lines.find((line) => line.key === "mercado");

    expect(linha?.value).toBe("3 mercados lidos");
    expect(dossier.heavyMissing).toEqual([]);
  });

  it("acende a linha do preço quando já há uma odd escrita", () => {
    const sem = buildDossier(input());
    const com = buildDossier(input({ oddsTyped: 2 }));

    expect(sem.lines.find((line) => line.key === "preco")?.value).toBeNull();
    expect(com.lines.find((line) => line.key === "preco")?.value).toBe(
      "2 odds escritas",
    );
    expect(com.known).toBe(sem.known + 1);
  });

  it("não dá o registo por sabido enquanto forem poucos jogos", () => {
    const poucos = buildDossier(input({ record: record({ samples: 12 }) }));
    const muitos = buildDossier(input({ record: record() }));

    expect(poucos.lines.find((line) => line.key === "registo")?.value).toBeNull();
    expect(muitos.lines.find((line) => line.key === "registo")?.value).toBe(
      "120 jogos conferidos",
    );
  });

  it("marca a forma em falta quando a época mal começou", () => {
    const dossier = buildDossier(
      input({
        form: { ...form, jogos_casa_rec: 0, jogos_fora_rec: 0 },
      }),
    );

    expect(dossier.lines.find((line) => line.key === "forma")?.value).toBeNull();
  });

  it("aguenta um jogo sem forma nenhuma carregada", () => {
    const dossier = buildDossier(input({ form: null }));

    expect(dossier.known).toBe(1);
    expect(() => objections(input({ form: null }), dossier)).not.toThrow();
  });
});

describe("objections", () => {
  it("desconta o exagero medido acima dos 55%", () => {
    const i = input();
    const contra = objections(i, buildDossier(i));
    const topo = contra.find((item) => item.key === "topo");

    expect(topo?.text).toContain("74,0%");
    expect(topo?.text).toContain("63,0%");
    expect(topo?.grave).toBe(true);
  });

  it("não inventa exagero nenhum numa probabilidade baixa", () => {
    const i = input({ headline: { market: "Casa", pct: 40 } });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "topo")).toBeUndefined();
  });

  it("diz sempre a odd abaixo da qual se perde", () => {
    const i = input();
    const contra = objections(i, buildDossier(i));
    const minima = contra.find((item) => item.key === "minima");

    // 63% medidos pedem 1,59: é esse o número que tem de aparecer, não o
    // 1,36 que os 74% prometidos dariam.
    expect(minima?.text).toContain("1,59");
    expect(minima?.grave).toBe(false);
  });

  it("avisa de histórico curto", () => {
    const i = input({ amostraLabel: "Baixa", amostraPct: 41 });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "amostra")?.grave).toBe(true);
  });

  it("traz o nosso registo para a mesa quando ele é mau", () => {
    const i = input({ record: record() });
    const contra = objections(i, buildDossier(i));
    const linha = contra.find((item) => item.key === "registo");

    expect(linha?.text).toContain("12,0 pontos a mais");
    expect(linha?.text).toContain("120 jogos");
  });

  it("cala-se sobre o registo quando ele está em linha", () => {
    const i = input({ record: record({ actual_pct: 73, gap_pp: -1 }) });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "registo")).toBeUndefined();
  });

  it("põe as graves à frente", () => {
    const i = input();
    const contra = objections(i, buildDossier(i));
    const primeiraLeve = contra.findIndex((item) => !item.grave);
    const ultimaGrave = contra.map((item) => item.grave).lastIndexOf(true);

    expect(ultimaGrave).toBeLessThan(primeiraLeve);
  });
});

describe("enumerate", () => {
  it("escreve uma lista como se fala", () => {
    expect(enumerate([])).toBe("");
    expect(enumerate(["lesões"])).toBe("lesões");
    expect(enumerate(["lesões", "notícias"])).toBe("lesões e notícias");
    expect(enumerate(["a", "b", "c"])).toBe("a, b e c");
  });
});

describe("o mercado como contraditório", () => {
  it("põe o preço que está na mesa ao lado do que farias falta", () => {
    const i = input({ market: mercado({ "1X": 1.80 }, { "1X": 56 }) });
    const contra = objections(i, buildDossier(i));
    const linha = contra.find((item) => item.key === "minima");

    // 74% prometidos valem 63% medidos, que pedem 1,59. A 1,80 a conta
    // fecha, por isso isto não é uma objecção grave.
    expect(linha?.text).toContain("1,80");
    expect(linha?.text).toContain("1,59");
    expect(linha?.grave).toBe(false);
  });

  it("trava a aposta quando o mercado paga menos do que a mínima", () => {
    const i = input({ market: mercado({ "1X": 1.40 }, { "1X": 71 }) });
    const contra = objections(i, buildDossier(i));
    const linha = contra.find((item) => item.key === "minima");

    expect(linha?.text).toContain("não há aposta");
    expect(linha?.grave).toBe(true);
  });

  it("avisa quando discordamos muito do mercado", () => {
    // Nós medimos 63%; o mercado dá 48%.
    const i = input({ market: mercado({ "1X": 2.05 }, { "1X": 48 }) });
    const contra = objections(i, buildDossier(i));
    const linha = contra.find((item) => item.key === "mercado");

    expect(linha?.text).toContain("63,0%");
    expect(linha?.text).toContain("48,0%");
    expect(linha?.text).toContain("quem costuma estar errado somos nós");
    expect(linha?.grave).toBe(true);
  });

  it("diz o contrário quando é o mercado a estar mais confiante", () => {
    const i = input({ market: mercado({ "1X": 1.25 }, { "1X": 78 }) });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "mercado")?.text).toContain(
      "sabem alguma coisa",
    );
  });

  it("cala-se quando estamos de acordo com o mercado", () => {
    const i = input({ market: mercado({ "1X": 1.60 }, { "1X": 62 }) });
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "mercado")).toBeUndefined();
  });

  it("volta à frase sem preço quando as casas não abriram o jogo", () => {
    const i = input();
    const contra = objections(i, buildDossier(i));

    expect(contra.find((item) => item.key === "minima")?.text).toContain(
      "abaixo de 1,59",
    );
  });
});
