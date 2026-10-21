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

    expect(dossier.total).toBe(10);
    // Histórico, forma, casa/fora e média da liga. Registo, preço, lesões,
    // notícias, árbitro e tempo ficam por preencher.
    expect(dossier.known).toBe(4);
  });

  it("trata lesões e notícias como buracos que pesam, e o árbitro não", () => {
    const dossier = buildDossier(input());

    // Pelo nome curto: "lesões e castigos e notícias da semana" tropeça.
    expect(dossier.heavyMissing).toEqual([
      "quem está de fora",
      "as notícias da semana",
    ]);
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
