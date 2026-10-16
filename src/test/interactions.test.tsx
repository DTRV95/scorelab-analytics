import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LevelWon } from "@/components/LevelWon";
import { PULL_THRESHOLD, usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useCountUp } from "@/hooks/useCountUp";

afterEach(cleanup);

function touch(type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true }) as TouchEvent & {
    touches: { clientX: number; clientY: number }[];
  };
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX: x, clientY: y }],
  });
  act(() => {
    window.dispatchEvent(event);
  });
}

function Puller({ onRefresh }: { onRefresh: () => void }) {
  const pulled = usePullToRefresh({ onRefresh });
  return <p>puxado {Math.round(pulled)}</p>;
}

describe("puxar para ir buscar outra vez", () => {
  it("vai buscar quando se puxa o suficiente e se larga", () => {
    const ask = vi.fn();
    render(<Puller onRefresh={ask} />);

    touch("touchstart", 100, 10);
    touch("touchmove", 100, 10 + PULL_THRESHOLD * 2.5);
    touch("touchend", 100, 10 + PULL_THRESHOLD * 2.5);

    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("não vai buscar por um toque curto", () => {
    const ask = vi.fn();
    render(<Puller onRefresh={ask} />);

    touch("touchstart", 100, 10);
    touch("touchmove", 100, 30);
    touch("touchend", 100, 30);

    expect(ask).not.toHaveBeenCalled();
  });

  it("deixa em paz um gesto de lado, que é alguém a passar os dias", () => {
    const ask = vi.fn();
    render(<Puller onRefresh={ask} />);

    touch("touchstart", 100, 10);
    touch("touchmove", 300, 40);
    touch("touchend", 300, 40);

    expect(ask).not.toHaveBeenCalled();
  });

  it("não se mete quando a página já está rolada", () => {
    const ask = vi.fn();
    window.scrollY = 400;
    render(<Puller onRefresh={ask} />);

    touch("touchstart", 100, 10);
    touch("touchmove", 100, 300);
    touch("touchend", 100, 300);

    expect(ask).not.toHaveBeenCalled();
    window.scrollY = 0;
  });
});

function Counter({ value }: { value: number }) {
  return <p>{useCountUp(value).toFixed(2)}</p>;
}

describe("o número que anda", () => {
  it("mostra o valor certo desde o primeiro render", () => {
    render(<Counter value={47.5} />);
    expect(screen.getByText("47.50")).toBeInTheDocument();
  });

  it("chega ao valor novo quando ele muda", async () => {
    const view = render(<Counter value={10} />);
    view.rerender(<Counter value={25} />);

    // Anda durante uns seiscentos milissegundos; com a máquina ocupada
    // pode demorar mais do que o segundo que o waitFor dá por omissão.
    await waitFor(() => expect(screen.getByText("25.00")).toBeInTheDocument(), {
      timeout: 4000,
    });
  });
});

describe("o momento de um nível ganho", () => {
  it("diz o nível, o que entrou e o que vem a seguir", () => {
    render(<LevelWon won={{ day: 7, amount: 12.5 }} onDone={() => undefined} />);

    expect(screen.getByText("Nível 7 fechado")).toBeInTheDocument();
    expect(screen.getByText("+12,50 €")).toBeInTheDocument();
    expect(screen.getByText("Vais no nível 8.")).toBeInTheDocument();
  });

  it("sai ao toque", () => {
    const done = vi.fn();
    render(<LevelWon won={{ day: 2, amount: 3 }} onDone={done} />);

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(done).toHaveBeenCalled();
  });

  it("não aparece sem nada para festejar", () => {
    render(<LevelWon won={null} onDone={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });
});
