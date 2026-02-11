//===========================================================================
//
// Copyright (c)  2000-2024 Entrust.  All rights reserved.
// 
//===========================================================================

package com.entrust.toolkit.examples.pkcs7;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.Enumeration;

import javax.naming.CommunicationException;
import javax.naming.TimeLimitExceededException;

import iaik.x509.X509Certificate;

import com.entrust.toolkit.PKCS7DecodeStream;
import com.entrust.toolkit.PKCS7EncodeStream;
import com.entrust.toolkit.User;
import com.entrust.toolkit.credentials.CredentialReader;
import com.entrust.toolkit.credentials.FilenameProfileReader;
import com.entrust.toolkit.exceptions.IExceptionWithCause;
import com.entrust.toolkit.exceptions.NotARecipientException;
import com.entrust.toolkit.exceptions.PKCS7Exception;
import com.entrust.toolkit.exceptions.SignatureException;
import com.entrust.toolkit.exceptions.UserException;
import com.entrust.toolkit.util.SecureStringBuffer;
import com.entrust.toolkit.x509.directory.JNDIDirectory;

/**
 * Sample to show use of PKCS7DecodeStream.
 * 
 * <p>
 * Usage:
 * <pre>
 * Decode path_to_epf password infile outfile [ip_address]
 * </pre>
 * <dl>
 * <dt>path_to_epf</dt><dd>Path to EPF file. For example, data/userdata/RSAUser2.epf</dd>
 * <dt>password</dt><dd>The password for the EPF. For example, ~Sample7~</dd>
 * <dt>infile</dt><dd>The PKCS7 encoded file to decode. For example, test.p7m</dd>
 * <dt>outfile</dt><dd>The name of the unprotected file that will be written. For example, test.txt</dd>
 * <dt>ip_address</dt><dd>Optional address of a Directory to connect to. For example, ldapserver.company.com</dd>
 * </dl>
 * 
 * For example, from the examples directory, 
 * <pre>
 * java -classpath ..\lib\enttoolkit.jar;classes com.entrust.toolkit.examples.pkcs7.Decode data/userdata/RSAUser2.epf ~Sample7~ test.p7m test.txt
 * </pre>
 * </p>
 * <p>
 * The message to be decoded can be created with <code>PKCS7EncodeStream</code>. See {@link Encode}
 * for an example usage.
 * </p> 
 */
public class Decode
{
    public static void main(String args[])
    {
        //  Check the command-line arguments.  If they're not there, then
        // print out a usage message.
        if ((args.length < 4) || (args.length > 5)) {
            System.out.println();
            System.out.println("decrypts and verifies a file");
            System.out.println();
            System.out.println("usage: Decode <profile> <password> <input file> <output file> [<dir ip address>]");
            System.out.println();
            System.exit(0);
        }
        try {
            //  Parse in the command-line arguments.
            String profile = args[0];
            String password = args[1];
            String inputFile = args[2];
            String outputFile = args[3];
            String ipAddress = null;
            if (args.length == 5) {
                ipAddress = args[4];
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
                // If a Directory address was supplied, connect to the
                // Directory so that certificates can be validated.
                JNDIDirectory dir = new JNDIDirectory(ipAddress, 389);
                
                // Uncomment the next line to set the Directory search timeout
                // to 10 seconds.
                // dir.setSearchTimeout(10000);
                user.setConnections(dir, null);
            }
            CredentialReader cr = new FilenameProfileReader(profile);
            System.out.println("login");
            user.login(cr, new SecureStringBuffer(new StringBuffer(password)));
            System.out.println("   done");

            //  Create the decoder object, giving it the stream from which to
            // read.
            System.out.println("decoding");
            PKCS7DecodeStream decoder = new PKCS7DecodeStream(
                user,
                new FileInputStream(inputFile));


            FileOutputStream fos = new FileOutputStream(outputFile);

            //  Read all of the data that we can read from the decode
            // stream, and write it out to another stream.
            byte[] b = new byte[128];
            int i = decoder.read(b);
            while (i >= 0) {
                fos.write(b, 0, i);
                i = decoder.read(b);
            }

            // Print out information about the decode process.
            int operation = decoder.getOperation();
            switch (operation) {
            case PKCS7EncodeStream.SIGN_AND_ENCRYPT:
                System.out.println("Operation: " + "SIGN_AND_ENCRYPT");
                break;

            case PKCS7EncodeStream.ENCRYPT_ONLY:
                System.out.println("Operation: " + "ENCRYPT_ONLY");
                break;

            case PKCS7EncodeStream.SIGN_ONLY:
                System.out.println("Operation: " + "SIGN_ONLY");
                break;

            case PKCS7EncodeStream.CLEAR_SIGN:
                System.out.println("Operation: " + "CLEAR_SIGN");
                break;

            case PKCS7EncodeStream.EXPORT_CERTIFICATES:
                System.out.println("Operation: " + "EXPORT_CERTIFICATES");
                break;
            }

            // Print info about the signer if p7 was signed only.
            if ((operation == PKCS7EncodeStream.SIGN_ONLY) || (operation == PKCS7EncodeStream.SIGN_AND_ENCRYPT)) {
                for (int index = 0; index < decoder.getNumberOfSignatures(); index++) {
                    X509Certificate signingCert = decoder.getSignerCertificate(index);
                    System.out.println("   Signer " + (index + 1) + ": " + signingCert.getSubjectDN());
                    System.out.println("   Serial Number: " + signingCert.getSerialNumber());
                    System.out.println("   Issuer: " + signingCert.getIssuerDN());
                    System.out.println();
                }
            }

            // Print info about the included certificates. Programs may
            // want to do more complicated certificate verification,
            // for example checking for special extensions.
            if(operation != PKCS7EncodeStream.ENCRYPT_ONLY) {
                System.out.println("Included Certs:");
                for (Enumeration enumeration = decoder.getIncludedCertificates().elements(); enumeration.hasMoreElements();) {
                    X509Certificate cert = (X509Certificate)enumeration.nextElement();
                    System.out.println("   Subject: " + cert.getSubjectDN().getName());
                    System.out.println("   Serial Number: " + cert.getSerialNumber());
                    System.out.println("   Issuer : " + cert.getIssuerDN().getName());
                    System.out.println();
                }
            }

            // Close the streams.
            decoder.close();
            fos.close();
            System.out.println("   done");
        }
        catch(CertificateException e)
        {
            // Thrown by the call to User.login(), indicating a problem with
            // the certificates in the user's credential store.
            // May need to recover in the case of an Entrust identity. 
            e.printStackTrace();
        }
        catch(NoSuchAlgorithmException e)
        {
            // Indicates the signing or encryption algorithm in the
            // PKCS#7 being decoded is not recognized by this version
            // of the Toolkit.
            e.printStackTrace();
        }
        catch(UserException e)
        {
            // All exceptions relating to the use of the User object.
            // Most likely due to a bad password.
            e.printStackTrace();
        }
        catch(NotARecipientException e)
        {
            // The PKCS7 was encrypted, but the User being used to decrypt it
            // was not a recipient.
            System.out.println("User is not a recipient of the provided PKCS7, it cannot be read.");
            e.printStackTrace();
        }
        catch(SignatureException e)
        {
            // The signature on the data did not validate. This is BAD, the data
            // cannot be trusted.
            System.out.println("Data in the PKCS7, but the signature did not validate.");
            e.printStackTrace();
        }
        catch(PKCS7Exception e)
        {
            // There was a problem with the PKCS7 data itself.
            // There are a variety of subclasses of PKCS7Exception for different
            // classes of problem that may be thrown by calls to the 
            // PKCS7DecodeStream.read methods, see the javadoc for PKCS7Exception
            // for details.
            // Since these exceptions can be chained together, determining
            // the real root cause and the action to take can be somewhat tricky.
            // The example here shows how to find out if there was a problem when
            // communicating with the Directory.
            e.printStackTrace();
            if( isDirectoryResponding(e) )
            {
                System.out.println("The exception is not related to the Directory.");
            }
            else
            {
                System.out.println("The exception is related to the Directory not responding.");
            }
        }
        catch(IOException e)
        {
            // Generic IO Exception that may have happened, either because
            // the epf file couldn't be found, or there was an IO problem reading
            // from the PKCS7 data stream.
            e.printStackTrace();
        }
    }

    /**
     * <p>Return whether or not there is a problem with the Directory based on
     * the given exception. When a user has a directory connection, for
     * example with a <code>JNDIDirectory</code>, the final step in validating
     * the signature on a PKCS7 file is to validate the signer's certificate.
     * This can cause Directory searches, and if the Directory is not responding
     * the validation will fail.</p>
     * 
     * <p>What to do in this case is not easily defined. The Toolkit will already
     * try to reconnect to the Directory if it is disconnected, but if the reconnect fails
     * it doesn't mean that the validation would fail if this same program was tried again
     * a minute later.</p>
     *
     * <p>Note that this method only determines if the Directory was responding. It is
     * possible in replicated environments that there were replication delays,
     * meaning valid data was being searched for but was not found as it had yet to
     * reach the Directory being searched. This could cause validation to
     * fail as the data required was reported as not being available.</p> 
     * 
     * @param possibleCause
     *     the exception that may be related to the Directory not responding. 
     *
     * @return
     *     whether or not the Directory was responding.
     */
    public static boolean isDirectoryResponding(Throwable possibleCause)
    {
        if( possibleCause instanceof TimeLimitExceededException )
        {
            // A TimeLimitExceededException indicates that the Directory was
            // contacted, but didn't return results within the specified timeout period.
            // This may indicate a heavily overloaded Directory, or a problem with the
            // Directory itself.
            return false;
        }
        else if( possibleCause instanceof CommunicationException )
        {
            // A CommunicationException indicates the Directory couldn't be
            // contacted, or that the connection was dropped unexpectedly.
            return false;
        }
        else if( possibleCause instanceof IExceptionWithCause )
        {
            // Recursively call this method with the cause of the given exception.
            IExceptionWithCause exceptionWithCause = (IExceptionWithCause)possibleCause;
            return isDirectoryResponding(exceptionWithCause.getCause());
        }
        else
        {
            // None of the above cases, so it's not related to the responsiveness
            return true;
        }
    }
}
