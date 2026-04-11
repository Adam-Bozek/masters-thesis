/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2025-10-12 21:58:26
 * @ Description: 	This repository contains a full-stack application suite developed within a master’s thesis.
	   It is designed to support the screening of children using the Slovak
	   implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
 * @ License: 	This program is free software: you can redistribute it and/or modify it under the terms of
	   the GNU Affero General Public License as published by the Free Software Foundation, either
	   version 3 of the License, or any later version. This program is distributed in the hope
	   that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
	   of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
     See the GNU Affero General Public License for more details.
	   You should have received a copy of the GNU Affero General Public License along with this program.
	   If not, see <https://www.gnu.org/licenses/>..
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "./AuthContext";

type WithAuthProps = Record<string, unknown>;

const withAuth = <P extends WithAuthProps>(Wrapped: React.ComponentType<P>) => {
  const ComponentWithAuth = (props: P) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.replace("/");
      }
    }, [loading, user, router]);

    if (loading) return <p>Načítavam...</p>;

    return user ? <Wrapped {...props} /> : null;
  };

  return ComponentWithAuth;
};

export default withAuth;
