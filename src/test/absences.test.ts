import { describe, expect, it } from "vitest";
import {
  backLabel,
  describeAbsence,
  reasonLabel,
  sortAbsences,
  statusLabel,
} from "@/lib/absences";

const hoje = new Date("2026-10-22T12:00:00Z");

describe("statusLabel", () => {
  it("diz em português o que a fonte diz em inglês", () => {
    expect(statusLabel("injured")).toBe("lesionado");
    expect(statusLabel("doubtful")).toBe("em dúvida");
    expect(statusLabel("suspended")).toBe("suspenso");
  });

  it("deixa passar o que não sabe traduzir", () => {
    // O original é pelo menos verdade; uma tradução inventada não é.
    expect(statusLabel("algo_novo")).toBe("algo_novo");
  });
});

describe("reasonLabel", () => {
  it("troca a ficha clínica por português corrente", () => {
    expect(reasonLabel("Cruciate Ligament Injury")).toBe("ligamento cruzado");
    expect(reasonLabel("Meniscus Injury")).toBe("menisco");
    expect(reasonLabel("coach_decision")).toBe("decisão do treinador");
  });

  it("não inventa o que não conhece", () => {
    expect(reasonLabel("Weird New Thing")).toBe("Weird New Thing");
    expect(reasonLabel("")).toBe("");
  });
});

describe("backLabel", () => {
  it("escreve a data como se fala", () => {
    expect(backLabel("2026-12-10", hoje)).toBe("volta a 10 dez");
  });

  it("cala-se quando a data já passou", () => {
    // Ou já voltou e a ficha está velha, ou ninguém sabe. Dizer "volta a
    // 20 out" num dia 22 só confunde.
    expect(backLabel("2026-10-20", hoje)).toBe("");
  });

  it("aguenta uma data que não é data", () => {
    expect(backLabel("", hoje)).toBe("");
    expect(backLabel("nunca", hoje)).toBe("");
  });
});

describe("describeAbsence", () => {
  it("junta estado, motivo e regresso", () => {
    expect(
      describeAbsence(
        {
          name: "João Costa",
          status: "injured",
          reason: "Meniscus Injury",
          back: "2026-12-10",
        },
        hoje,
      ),
    ).toEqual(["lesionado", "menisco", "volta a 10 dez"]);
  });

  it("não repete a mesma coisa duas vezes", () => {
    expect(
      describeAbsence(
        { name: "Alguém", status: "suspended", reason: "suspension" },
        hoje,
      ),
    ).toEqual(["suspenso", "castigo"]);
  });

  it("aguenta um ausente de quem só se sabe o nome", () => {
    expect(describeAbsence({ name: "Alguém", status: "" }, hoje)).toEqual([]);
  });
});

describe("sortAbsences", () => {
  it("põe os certos à frente das dúvidas", () => {
    const ordenados = sortAbsences([
      { name: "Dúvida", status: "doubtful" },
      { name: "Certo", status: "injured" },
    ]);

    expect(ordenados.map((p) => p.name)).toEqual(["Certo", "Dúvida"]);
  });

  it("dentro de cada grupo, por nome", () => {
    const ordenados = sortAbsences([
      { name: "Zé", status: "injured" },
      { name: "Ávila", status: "injured" },
    ]);

    expect(ordenados.map((p) => p.name)).toEqual(["Ávila", "Zé"]);
  });

  it("não mexe na lista que recebeu", () => {
    const original = [
      { name: "Dúvida", status: "doubtful" },
      { name: "Certo", status: "injured" },
    ];
    sortAbsences(original);

    expect(original[0].name).toBe("Dúvida");
  });
});
