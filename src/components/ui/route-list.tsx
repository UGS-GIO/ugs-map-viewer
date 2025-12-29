import { useRouter, Link } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RouteInfo {
    path: string;
    fullPath: string;
    title?: string;
    description?: string;
}

// todo: get this to work with auth to restrict showing certain routes
// todo: status flag to prevent from showing public (but in progress) routes
export function RouteList() {
    const router = useRouter();

    // Get all routes from the router
    const getAllRoutes = (): RouteInfo[] => {
        const routes: RouteInfo[] = [];

        const traverseRoutes = (routeNode: any, parentPath = '') => {
            if (!routeNode) return;

            const currentPath = routeNode.path || '';
            const fullPath = parentPath + currentPath;

            // Skip root route and routes that are just path segments
            if (fullPath && fullPath !== '/' && !fullPath.includes('$')) {
                // Clean up the path
                const cleanPath = fullPath.replace(/\/+/g, '/');

                routes.push({
                    path: currentPath,
                    fullPath: cleanPath,
                    title: routeNode.options?.meta?.title || getRouteTitle(cleanPath),
                    description: routeNode.options?.meta?.description || getRouteDescription(cleanPath),
                });
            }

            // Recursively traverse child routes
            if (routeNode.children) {
                routeNode.children.forEach((child: any) => {
                    traverseRoutes(child, fullPath);
                });
            }
        };

        // Start traversing from the route tree
        if (router.routeTree) {
            traverseRoutes(router.routeTree);
        }

        return routes.filter(route =>
            route.fullPath !== '/' &&
            !route.fullPath.includes('$') &&
            !route.fullPath.includes('_layout')
        );
    };

    // Helper function to generate nice titles from paths
    const getRouteTitle = (path: string): string => {
        return path
            .split('/')
            .filter(Boolean)
            .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join(' ');
    };

    // Helper function to generate descriptions
    const getRouteDescription = (path: string): string => {
        const descriptions: Record<string, string> = {
            '/ccs': 'Carbon Capture, Utilization & Storage mapping interface',
            '/about': 'Learn more about our platform',
            '/contact': 'Get in touch with us',
            // Add more descriptions as needed
        };

        return descriptions[path] || `Maps to ${path}`;
    };

    const routes = getAllRoutes();

    return (
        <div className="flex flex-col items-center space-y-8 p-4">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold mb-2">Available Routes</h2>
                <p className="text-muted-foreground">
                    Navigate to any of the available pages in the application.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {routes.map((route) => (
                    <Card key={route.fullPath} className="transition-all hover:shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                <Link
                                    to={route.fullPath}
                                    className="text-foreground hover:text-primary transition-colors"
                                >
                                    {route.title}
                                </Link>
                            </CardTitle>
                            <CardDescription className="font-mono text-xs">
                                {route.fullPath}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-3">
                                {route.description}
                            </p>
                            <Link
                                to={route.fullPath}
                                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                            >
                                Visit page →
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {routes.length === 0 && (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                            No routes found. Make sure your router is properly configured.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// Alternative simpler version if the above doesn't work with your router setup
export function SimpleRouteList() {
    // Manually define your routes if the programmatic approach doesn't work
    const routes: RouteInfo[] = [
        {
            path: '/carbonstorage',
            fullPath: '/carbonstorage/',
            title: 'Carbon Storage Portal',
            description: 'A tool for the public, scientists, and industry professionals interested in Utah carbon capture, utilization, and storage resources.'
        },
        {
            path: '/hazards',
            fullPath: '/hazards/',
            title: 'Geologic Hazards portal',
            description: 'Information on the type, location, and relative susceptibility of mapped geologic hazards in Utah.'
        }
    ];

    return (
        <div className="flex flex-col items-center space-y-8 p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {routes.map((route) => (
                    <Card key={route.fullPath} className="transition-all hover:shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                <Link
                                    to={route.fullPath}
                                    className="text-foreground hover:text-primary transition-colors"
                                >
                                    {route.title}
                                </Link>
                            </CardTitle>
                            <CardDescription className="font-mono text-xs">
                                {route.fullPath}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-3">
                                {route.description}
                            </p>
                            <Link
                                to={route.fullPath}
                                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                            >
                                Visit page →
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}