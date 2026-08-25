import type { Metadata } from "next";
import BookSurfGame from "@/features/book-surf/BookSurfGame";

export const metadata: Metadata = {
  title: "Book Surf | BookSurf",
  description: "Surf pages of books in the BookSurf game.",
};

export default function BookSurfPage() {
  return <BookSurfGame />;
}
