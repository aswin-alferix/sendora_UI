"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface NavLinkProps {
    href: string;
    children: ReactNode;
    className?: string;
    activeClassName?: string;
    [key: string]: any;
}

export function NavLink({ href, children, className, activeClassName, ...props }: NavLinkProps) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={cn(className, isActive && activeClassName)}
            {...props}
        >
            {children}
        </Link>
    );
}
