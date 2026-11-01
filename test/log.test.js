import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("CampusVehicleLog", () => {
  let c, admin, guard, other;
  const h = ethers.keccak256(ethers.toUtf8Bytes("PB10AB1234"));
  beforeEach(async () => {
    [admin, guard, other] = await ethers.getSigners();
    c = await ethers.deployContract("CampusVehicleLog");
    await c.addGuard(guard.address);
    await c.registerVehicle(h);
  });
  it("logs entry then exit", async () => {
    await c.connect(guard).logEntry(h, 1);
    await c.connect(guard).logExit(h, 1);
    expect(await c.getLogCount()).to.equal(2);
  });
  it("blocks double entry", async () => {
    await c.connect(guard).logEntry(h, 1);
    await expect(c.connect(guard).logEntry(h, 1)).to.be.revertedWith("Already inside campus");
  });
  it("blocks non-guards", async () => {
    await expect(c.connect(other).logEntry(h, 1))
      .to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, await c.GUARD_ROLE());
  });
});
