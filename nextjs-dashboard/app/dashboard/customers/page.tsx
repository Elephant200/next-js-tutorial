export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate loading
  return <div>Content Loaded</div>;
}