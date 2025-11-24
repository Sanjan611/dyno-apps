import Link from "next/link";

export default function ProjectGalleryPage() {
  const mockProjects = [
    {
      id: 1,
      name: "E-commerce App",
      description: "A shopping app with cart and checkout",
      lastModified: "2 hours ago",
    },
    {
      id: 2,
      name: "Fitness Tracker",
      description: "Track workouts and nutrition",
      lastModified: "1 day ago",
    },
    {
      id: 3,
      name: "Social Media Feed",
      description: "Instagram-like social feed app",
      lastModified: "3 days ago",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <h1 className="text-2xl font-bold">Dyno Apps</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/builder"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              New Project
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Project Gallery</h2>
          <p className="text-muted-foreground">
            Manage and edit your mobile applications
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProjects.map((project) => (
            <div
              key={project.id}
              className="p-6 border rounded-lg hover:shadow-lg transition-shadow bg-card"
            >
              <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
              <p className="text-muted-foreground mb-4">
                {project.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {project.lastModified}
                </span>
                <Link
                  href="/builder"
                  className="text-primary hover:underline text-sm"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}

          <Link
            href="/builder"
            className="p-6 border border-dashed rounded-lg hover:border-primary hover:bg-accent transition-colors flex items-center justify-center min-h-[200px]"
          >
            <div className="text-center">
              <div className="text-4xl mb-2">+</div>
              <p className="text-muted-foreground">Create New Project</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}

