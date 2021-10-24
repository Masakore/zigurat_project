// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Deploy our FacilityBooking.sol
  await deploy("FacilityBooking", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    log: true,
  });

  // Uncomment below to transfer ownership
  // const yourContract = await ethers.getContract("FacilityBooking", deployer);
  // await yourContract.transferOwnership("0xbcC898616822C3e44154eCc64aD794790B73A3a7");

};
module.exports.tags = ["FacilityBooking"];
