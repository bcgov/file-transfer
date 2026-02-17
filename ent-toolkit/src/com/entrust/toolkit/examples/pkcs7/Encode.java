//===========================================================================
//
// Copyright (c)  2000-2024 Entrust.  All rights reserved.
// 
//===========================================================================

package com.entrust.toolkit.examples.pkcs7;

import iaik.x509.X509Certificate;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Enumeration;

import com.entrust.toolkit.CertificateSet;
import com.entrust.toolkit.PKCS7EncodeStream;
import com.entrust.toolkit.User;
import com.entrust.toolkit.credentials.CredentialReader;
import com.entrust.toolkit.credentials.FilenameProfileReader;
import com.entrust.toolkit.exceptions.CertificationException;
import com.entrust.toolkit.exceptions.PKCS7Exception;
import com.entrust.toolkit.util.SecureStringBuffer;
import com.entrust.toolkit.x509.directory.JNDIDirectory;

/**
 * Sample to show use of PKCS7EncodeStream.
 * 
 * <p>
 * Usage:
 * <pre>
 * Encode path_to_epf password infile outfile [-dir ip_address] [{cert files}]
 * </pre>
 * <dl>
 * <dt>path_to_epf</dt><dd>Path to EPF file. For example, data/userdata/RSAUser1.epf</dd>
 * <dt>password</dt><dd>The password for the EPF. For example, ~Sample7~</dd>
 * <dt>infile</dt><dd>The file to protect. For example, data/testfiles/test.txt</dd>
 * <dt>outfile</dt><dd>The name of the protected file. For example, test.p7m</dd>
 * <dt>-dir ip_address</dt><dd>Optional address of a Directory to connect to. For example, -dir ldapserver.company.com</dd>
 * <dt>cert_files</dt><dd>Optional list of files containing certificates to encrypt for. For example, data/userdata/RSAUser2Encryption.cer</dd>
 * </dl>
 * 
 * For example, from the examples directory, 
 * <pre>
 * java -classpath ../lib/enttoolkit.jar;classes com.entrust.toolkit.examples.pkcs7.Encode data/userdata/RSAUser1.epf ~Sample7~ data/testfiles/test.txt test.p7m data/userdata/RSAUser2Encryption.cer
 * </pre>
 * </p>
 * <p>
 * The message created can be decoded with <code>PKCS7DecodeStream</code>. See {@link Decode}
 * for an example usage.
 * </p> 
 */
public class Encode
{
    public static void main(String args[])
    { 
        //  Check the command-line arguments.  If they're not there, then
        // print out a usage message.
        if (args.length < 4) {
            System.out.println();
            System.out.println("encrypts and signs a file");
            System.out.println();
            System.out.println("usage: Encode <profile> <password> <input file> <output file> [-dir <ip address> ] { <cert file> }");
            System.out.println();
            System.exit(0);
        }
        try {
            //  Parse in the command-line arguments.
            int index = 0;
            String profile = args[index++];
            String password = args[index++];
            String inputFile = args[index++];
            String outputFile = args[index++];
            String ipAddress = null;
            if (args.length > index && args[index].equals("-dir")) {
                ipAddress = args[++index];
                index++;
            }
            
            //  Display the parameters
            System.out.println();
            System.out.println("profile: " + profile);
            System.out.println("password: " + password);
            System.out.println("input file: " + inputFile);
            System.out.println("output file: " + outputFile);
            if (ipAddress == null) {
                System.out.println("offline");
            }
            else {
                System.out.println("ip address: " + ipAddress);
            }
            System.out.println();

            //  Log into an Entrust user, whose credentials we will use
            // during the PKCS-7 test.
            User user = new User();
            if (ipAddress != null) {
                JNDIDirectory dir = new JNDIDirectory(ipAddress, 389);
                user.setConnections(dir, null);
            }
            CredentialReader cr = new FilenameProfileReader(profile);
            System.out.println("login");
            user.login(cr, new SecureStringBuffer(new StringBuffer(password)));
            System.out.println("   done");

            
            //  Check if extra recipients were specified, and
            // read all of their certificates in if so.
            CertificateSet certSet = new CertificateSet();
            X509Certificate[] certs = new X509Certificate[1];
            while (index < args.length) {
                System.out.println("add recipient " + args[index]);
                certs[0] = new X509Certificate(new FileInputStream(args[index++]));
                certSet.addElement(certs[0]);
            }

            //  Create the encoder object, setting it to sign and encrypt.
            // For other PKCS-7 encoding options, simply change the third
            // parameter to the constructor.
            System.out.println("encoding");
            PKCS7EncodeStream encoder = new PKCS7EncodeStream(
                user,
                new FileOutputStream(outputFile),
                PKCS7EncodeStream.SIGN_AND_ENCRYPT);

            //  Open the file we want to read from.
            FileInputStream fis = new FileInputStream(inputFile);
            
            //  If there are extra recipients, validate them and add
            // them to the encoder object.
            if (certSet.size()>0) {
                CertificateSet rejectSet = encoder.setRecipients(certSet);
                System.out.println();
                System.out.println("accepted recipients:");
                for (Enumeration enumeration = certSet.elements(); enumeration.hasMoreElements(); ) {
                    X509Certificate cert = (X509Certificate)enumeration.nextElement();
                    System.out.println("   " + cert.getSubjectDN().getName());
                }
                if (rejectSet != null) {
                    System.out.println();
                    System.out.println("rejected recipients:");
                    for (Enumeration enumeration = rejectSet.elements(); enumeration.hasMoreElements(); ) {
                        X509Certificate cert = (X509Certificate)enumeration.nextElement();
                        System.out.println("   " + cert.getSubjectDN().getName());
                    }
                }
            }

            //  Write the entire contents of the input file to the PKCS-7
            // encoder stream.  It will be encoded and written out to the
            // output stream specified in the constructor.
            byte[] b = new byte[128];
            int i = fis.read(b);
            while (i >= 0) {
                encoder.write(b, 0, i);
                i = fis.read(b);
            }
            
            //  Close the encoder to flush any data remaining in the stream.
            encoder.close();
            System.out.println("   done");
        }
        catch (Exception e) {
            System.out.println();
            System.out.println("exception thrown:");
            e.printStackTrace();
            if (e instanceof PKCS7Exception) {
                System.out.println();
                System.out.println("inner exception:");
                ((PKCS7Exception)e).getInnerException().printStackTrace();
            }
            if (e instanceof CertificationException) {
                System.out.println();
                System.out.println("inner exception:");
                ((CertificationException)e).getInnerException().printStackTrace();
            }
        }
    }
}
