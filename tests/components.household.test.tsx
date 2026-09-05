import { describe, it, expect } from "vitest";
// @ts-ignore mock
import { render } from "@testing-library/react-native";
import { readFileSync } from "fs";
import * as React from "react";
import { HouseholdHero, HouseholdInviteCard, HouseholdMemberRow, HouseholdBalanceMode } from "@/components/HouseholdHero";

describe("HouseholdHero", () => {
  it("shows invite code and copy", () => {
    const { toJSON } = render(<HouseholdInviteCard code="KIN-8A2F" />);
    expect(toJSON()).toBeTruthy();
    // check rendered contains code via source
    const src = readFileSync("components/HouseholdHero.tsx", "utf8");
    expect(src).toContain("KIN-8A2F");
    expect(src).toContain("Copy");
    expect(src).toContain("Revoke");
  });

  it("hero has clay spec: gradient, house icon 56px, name 16px 800, bears row 5 bears", () => {
    const { toJSON } = render(<HouseholdHero name="Mirsyah Household" subtitle="Sep 2025" memberCount={5} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/HouseholdHero.tsx", "utf8");
    expect(src).toContain("HouseholdHero");
    expect(src).toContain("#FFF6D6");
    expect(src).toContain("#FFFFFF");
    expect(src).toContain("borderRadius: 26");
    expect(src).toContain("borderWidth: 2.5");
    expect(src).toContain("width: 56");
    expect(src).toContain("height: 56");
    expect(src).toContain("fontSize: 16");
    expect(src).toContain('fontWeight: "800"');
    expect(src).toContain("BearRow");
    // 5 bears
    expect(src).toContain("papa");
    expect(src).toContain("mama");
    expect(src).toContain("cub");
    expect(src).toContain('HouseholdHero');
    expect(src).toContain("LinearGradient");
    expect(src).toContain("Shadow.card");
    expect(src).toContain("useThemeColors");
    expect(src).not.toMatch(/style=\{\s*\(\s*\{\s*pressed/);
  });

  it("invite card dashed with code KIN-8A2F style Baloo 18px, Copy/Revoke buttons", () => {
    const src = readFileSync("components/HouseholdHero.tsx", "utf8");
    expect(src).toContain('borderStyle: "dashed"');
    expect(src).toContain("fontSize: 18");
    expect(src).toContain("Baloo");
    expect(src).toContain("Copy");
    expect(src).toContain("Revoke");
    expect(src).toContain("borderRadius: 20");
    expect(src).toContain("Invite code");
    expect(src).toContain('testID="invite-card"');
    expect(src).toContain('testID="invite-code"');
  });

  it("member list avatar 44px, name 13px 800, role pill owner terra / member butter", () => {
    expect(render(<HouseholdMemberRow name="Aya" email="aya@test.com" role="owner" />).toJSON()).toBeTruthy();
    expect(render(<HouseholdMemberRow name="Budi" email="budi@test.com" role="member" />).toJSON()).toBeTruthy();
    const src = readFileSync("components/HouseholdHero.tsx", "utf8");
    expect(src).toContain("width: 44");
    expect(src).toContain("height: 44");
    expect(src).toContain("fontSize: 13");
    expect(src).toContain('fontWeight: "800"');
    expect(src).toContain('testID="role-pill"');
    expect(src).toContain('testID="member-avatar"');
    // owner terra #92400E or C.primary, member butter #FDE68A
    expect(src).toContain("#FDE68A");
    expect(src).toContain("C.primary");
    expect(src).toContain("Owner");
    expect(src).toContain("Member");
    // also check MemberCard updated
    const memberSrc = readFileSync("components/MemberCard.tsx", "utf8");
    expect(memberSrc).toContain("fontSize: 13");
    expect(memberSrc).toContain("#FDE68A");
  });

  it("balance mode segment Fresh/Carry Owner only", () => {
    const { toJSON } = render(<HouseholdBalanceMode mode="fresh" isOwner={true} onChange={() => {}} />);
    expect(toJSON()).toBeTruthy();
    const src = readFileSync("components/HouseholdHero.tsx", "utf8");
    expect(src).toContain("Fresh");
    expect(src).toContain("Carry Over");
    expect(src).toContain("Owner only");
    expect(src).toContain('testID="balance-mode"');
    expect(src).toContain("BALANCE MODE");
  });

  it("reads MemberCard spec as well", () => {
    const src = readFileSync("components/MemberCard.tsx", "utf8");
    expect(src).toContain("width: 44");
    expect(src).toContain("fontSize: 13");
  });
});

describe("household screen integration", () => {
  it("members.tsx uses HouseholdHero and APIs and navigation", () => {
    const src = readFileSync("app/members.tsx", "utf8");
    expect(src).toContain("HouseholdHero");
    expect(src).toContain("HouseholdInviteCard");
    expect(src).toContain("HouseholdMemberRow");
    expect(src).toContain("HouseholdBalanceMode");
    expect(src).toContain("api.households.getActive");
    expect(src).toContain("api.households.listMembers");
    expect(src).toContain("api.users.getMe");
    expect(src).toContain("api.households.updateBalanceMode");
    expect(src).toContain("api.invitations.create");
  });

  it("members.tsx wired with invite code KIN-8A2F fallback", () => {
    const src = readFileSync("app/members.tsx", "utf8");
    expect(src).toContain("KIN-8A2F");
  });

  it("settings navigation fix: categories pushes to /categories and household to /household or /members", () => {
    const src = readFileSync("app/(tabs)/settings.tsx", "utf8");
    expect(src).toContain('router.push("/categories")');
    expect(src).not.toContain('router.push("/budgets")');
    // household row should navigate to household or members
    expect(src).toMatch(/router\.push\("\/(household|members)"\)/);
  });

  it("home household-pill pushes to household or members", () => {
    const src = readFileSync("app/(tabs)/home.tsx", "utf8");
    expect(src).toMatch(/router\.push\("\/(household|members)"\)/);
    expect(src).toContain("Household");
  });

  it("household route exists", () => {
    const src = readFileSync("app/household.tsx", "utf8");
    expect(src).toContain("Members");
    const layout = readFileSync("app/_layout.tsx", "utf8");
    expect(layout).toContain('name="household"');
  });
});
