import { describe, it, expect } from "vitest";
import { PERMISSIONS, roleHasPermission, roleCanAccessModule } from "@/lib/constants";

describe("roleHasPermission", () => {
  it("Owner has every permission", () => {
    for (const p of Object.values(PERMISSIONS)) {
      expect(roleHasPermission("Owner", p), p).toBe(true);
    }
  });

  it("Admin has all except billing", () => {
    expect(roleHasPermission("Admin", PERMISSIONS.manageBilling)).toBe(false);
    expect(roleHasPermission("Admin", PERMISSIONS.manageSettings)).toBe(true);
    expect(roleHasPermission("Admin", PERMISSIONS.manageUsers)).toBe(true);
  });

  it("Staff is limited to operational permissions", () => {
    expect(roleHasPermission("Staff", PERMISSIONS.createRental)).toBe(true);
    expect(roleHasPermission("Staff", PERMISSIONS.performInspection)).toBe(true);
    expect(roleHasPermission("Staff", PERMISSIONS.recordPayment)).toBe(true);
    expect(roleHasPermission("Staff", PERMISSIONS.manageSettings)).toBe(false);
    expect(roleHasPermission("Staff", PERMISSIONS.viewReports)).toBe(false);
  });

  it("Inspector can inspect and manage damage only", () => {
    expect(roleHasPermission("Inspector", PERMISSIONS.performInspection)).toBe(true);
    expect(roleHasPermission("Inspector", PERMISSIONS.manageDamage)).toBe(true);
    expect(roleHasPermission("Inspector", PERMISSIONS.manageRentals)).toBe(false);
    expect(roleHasPermission("Inspector", PERMISSIONS.recordPayment)).toBe(false);
  });

  it("Accountant handles finances only", () => {
    expect(roleHasPermission("Accountant", PERMISSIONS.recordPayment)).toBe(true);
    expect(roleHasPermission("Accountant", PERMISSIONS.manageExpenses)).toBe(true);
    expect(roleHasPermission("Accountant", PERMISSIONS.viewReports)).toBe(true);
    expect(roleHasPermission("Accountant", PERMISSIONS.manageAssets)).toBe(false);
    expect(roleHasPermission("Accountant", PERMISSIONS.performInspection)).toBe(false);
  });

  it("unknown role gets no permissions", () => {
    expect(roleHasPermission("Guest", PERMISSIONS.viewReports)).toBe(false);
  });
});

describe("roleCanAccessModule", () => {
  it("everyone can access the dashboard", () => {
    expect(roleCanAccessModule("Staff", "dashboard")).toBe(true);
    expect(roleCanAccessModule("Inspector", "dashboard")).toBe(true);
  });

  it("staff can create rentals but not view financials", () => {
    expect(roleCanAccessModule("Staff", "rentals")).toBe(true);
    expect(roleCanAccessModule("Staff", "reports")).toBe(false);
  });

  it("accountant sees financial modules", () => {
    expect(roleCanAccessModule("Accountant", "payments")).toBe(true);
    expect(roleCanAccessModule("Accountant", "budgets")).toBe(true);
    expect(roleCanAccessModule("Accountant", "rentals")).toBe(false);
  });

  it("inspector only sees inspections", () => {
    expect(roleCanAccessModule("Inspector", "inspections")).toBe(true);
    expect(roleCanAccessModule("Inspector", "assets")).toBe(false);
    expect(roleCanAccessModule("Inspector", "customers")).toBe(false);
  });

  it("manager sees operational modules but not settings", () => {
    expect(roleCanAccessModule("Manager", "assets")).toBe(true);
    expect(roleCanAccessModule("Manager", "rentals")).toBe(true);
    expect(roleCanAccessModule("Manager", "reports")).toBe(true);
    expect(roleCanAccessModule("Manager", "settings")).toBe(false);
  });

  it("unknown module is denied", () => {
    expect(roleCanAccessModule("Owner", "unknown")).toBe(false);
  });
});
