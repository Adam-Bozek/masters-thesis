/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2025-11-15 10:03:29
 * @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
		 It is designed to support the screening of children using the Slovak
		 implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
 * @ License: This program is free software: you can redistribute it and/or modify it under the terms of
		 the GNU Affero General Public License as published by the Free Software Foundation, either
		 version 3 of the License, or any later version. This program is distributed in the hope
		 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
		 of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
		 See the GNU Affero General Public License for more details.
		 You should have received a copy of the GNU Affero General Public License along with this program.
		 If not, see <https://www.gnu.org/licenses/>..
 */

"use client";

import "bootstrap/dist/css/bootstrap.min.css";
import { Navbar, Button } from "react-bootstrap";
import { useAuth } from "@/utilities/AuthContext";
import withAuth from "@/utilities/WithAuth";

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="container my-4">
        <div className="glass w-100">
          <Navbar expand="md" className="py-3 px-3 mx-4">
            <Navbar.Brand className="me-auto">
              <h1 className="h3 m-0">Zdravíme {user?.firstName}!</h1>
            </Navbar.Brand>

            <Navbar.Toggle aria-controls="main-navbar" />

            <Navbar.Collapse id="main-navbar" className="justify-content-md-end">
              <div className="d-flex flex-column flex-md-row gap-2 mt-3 mt-md-0">
                <Button variant="primary" href="/testing/marketplace">
                  Nová hra
                </Button>

                <Button variant="outline-primary" onClick={logout}>
                  Odhlásenie
                </Button>
              </div>
            </Navbar.Collapse>
          </Navbar>
        </div>
      </header>
    </>
  );
};

export default withAuth(Header);
