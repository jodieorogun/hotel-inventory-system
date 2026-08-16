export const staffRoles = [
    "owner",
    "procurement",
    "accountant",
    "storekeeper",
    "housekeeper",
] as const;

export type StaffRole = (typeof staffRoles)[number];

export const staffRoleLabels: Record<StaffRole, string> = {
    owner: "Owner",
    procurement: "Procurement",
    accountant: "Accountant",
    storekeeper: "Storekeeper",
    housekeeper: "Housekeeper",
};

export function isStaffRole(value: unknown): value is StaffRole {
    return staffRoles.includes(value as StaffRole);
}

export function formatStaffRole(value: string) {
    return isStaffRole(value)
        ? staffRoleLabels[value]
        : value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
              letter.toUpperCase()
          );
}
