import { useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useRouter } from "next/router";

interface WithAuthProps {
    [key: string]: unknown;
}

const withAuth = (WrappedComponent: React.ComponentType<WithAuthProps>) => {
    const ComponentWithAuth = (props: WithAuthProps) => {
        const { user, loading } = useAuth();
        const router = useRouter();

        useEffect(() => {
            if (!loading && !user) {
                router.push("/login"); // Redirect if not logged in
            }
        }, [user, loading, router]);

        if (loading) {
            return <p>Loading...</p>; // Show loading state while checking auth
        }

        return user ? <WrappedComponent {...props} /> : null; // Render wrapped component if user is authenticated
    };

    return ComponentWithAuth;
};

export default withAuth;
