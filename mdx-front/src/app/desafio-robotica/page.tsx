import type { Metadata } from "next";
import { RoboticaBoard } from "@/components/robotica/board";

export const instant = false;

export const metadata: Metadata = {
  title: "Desafio de Robótica",
  description: "Placar, chamada e cronômetro do 3º Desafio de Robótica Mermãs Digitais.",
};

export default function DesafioRoboticaPage() {
  return <RoboticaBoard />;
}
