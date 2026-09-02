import BookDiscovery from "@/features/books/BookDiscovery";

export const metadata = {
  title: "Surf Books — BookSurf",
  description: "Surf through books one strong recommendation at a time.",
};

export default function BooksPage(){
  return <BookDiscovery/>;
}
